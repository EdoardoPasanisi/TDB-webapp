import { createHmac, timingSafeEqual } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// Durata massima accettata per un video caricato (Cloudflare rifiuta oltre questo valore).
const STREAM_MAX_DURATION_SECONDS = 3600;
// Validita del token di playback firmato consegnato al cliente.
const STREAM_PLAYBACK_TTL_SECONDS = 60 * 60 * 4;

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Cloudflare Stream non configurato: manca ${name}.`);
  }
  return value;
}

function getAccountId(): string {
  return readEnv('CLOUDFLARE_ACCOUNT_ID');
}

function getApiToken(): string {
  return readEnv('CLOUDFLARE_STREAM_API_TOKEN');
}

export function isCloudflareStreamConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_API_TOKEN);
}

function buildUploadMetadata(entries: Record<string, string | true>): string {
  return Object.entries(entries)
    .map(([key, value]) =>
      value === true ? key : `${key} ${Buffer.from(String(value)).toString('base64')}`
    )
    .join(',');
}

export type StreamDirectUpload = {
  uploadUrl: string;
  uid: string;
};

/**
 * Crea un upload resumable (TUS) "direct creator": il client carica i byte
 * direttamente su Cloudflare tramite l'URL monouso restituito, senza che il
 * token API passi mai dal browser.
 */
export async function createStreamDirectUpload(args: {
  size: number;
  name?: string | null;
  bookingId: string;
  userId: string;
}): Promise<StreamDirectUpload> {
  const metadata = buildUploadMetadata({
    requiresignedurls: true,
    maxDurationSeconds: String(STREAM_MAX_DURATION_SECONDS),
    ...(args.name ? { name: args.name } : {}),
  });

  const response = await fetch(`${CF_API_BASE}/accounts/${getAccountId()}/stream?direct_user=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiToken()}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(args.size),
      'Upload-Creator': `${args.userId}:${args.bookingId}`,
      'Upload-Metadata': metadata,
    },
  });

  if (response.status !== 201) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Cloudflare non ha accettato l'upload (${response.status}). ${detail}`.trim());
  }

  const uploadUrl = response.headers.get('Location');
  const uid = response.headers.get('stream-media-id');
  if (!uploadUrl || !uid) {
    throw new Error('Cloudflare non ha restituito i dati di upload del video.');
  }

  return { uploadUrl, uid };
}

export type StreamVideoStatus = {
  uid: string;
  ready: boolean;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  errorReason: string | null;
};

export async function getStreamVideo(uid: string): Promise<StreamVideoStatus | null> {
  const response = await fetch(`${CF_API_BASE}/accounts/${getAccountId()}/stream/${uid}`, {
    headers: { Authorization: `Bearer ${getApiToken()}` },
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Cloudflare Stream lookup fallito (${response.status}). ${detail}`.trim());
  }

  const payload = (await response.json()) as {
    result?: {
      uid?: string;
      readyToStream?: boolean;
      duration?: number;
      thumbnail?: string;
      status?: { state?: string; errorReasonText?: string };
    };
  };

  const result = payload.result;
  if (!result?.uid) return null;

  const duration = typeof result.duration === 'number' && result.duration > 0 ? result.duration : null;

  return {
    uid: result.uid,
    ready: Boolean(result.readyToStream) || result.status?.state === 'ready',
    durationSeconds: duration,
    thumbnailUrl: result.thumbnail ?? null,
    errorReason: result.status?.errorReasonText ?? null,
  };
}

let cachedSigningKey: Promise<CryptoKey> | null = null;

function loadSigningKey(): Promise<CryptoKey> {
  if (!cachedSigningKey) {
    const pem = Buffer.from(readEnv('CLOUDFLARE_STREAM_SIGNING_KEY'), 'base64').toString('utf8');
    cachedSigningKey = importPKCS8(pem, 'RS256');
  }
  return cachedSigningKey;
}

/** Firma un token di playback a scadenza per un singolo video. */
export async function signStreamPlaybackToken(uid: string): Promise<string> {
  const keyId = readEnv('CLOUDFLARE_STREAM_SIGNING_KEY_ID');
  const key = await loadSigningKey();

  return new SignJWT({ kid: keyId })
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setSubject(uid)
    .setExpirationTime(`${STREAM_PLAYBACK_TTL_SECONDS}s`)
    .sign(key);
}

export function buildSignedIframeUrl(token: string): string {
  return `https://iframe.cloudflarestream.com/${token}`;
}

/** Verifica la firma del webhook Cloudflare Stream (header Webhook-Signature). */
export function verifyStreamWebhook(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((segment) => {
      const [key, ...rest] = segment.split('=');
      return [key.trim(), rest.join('=').trim()];
    })
  );

  const time = parts.time;
  const signature = parts.sig1;
  if (!time || !signature) return false;

  const expected = createHmac('sha256', secret).update(`${time}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
