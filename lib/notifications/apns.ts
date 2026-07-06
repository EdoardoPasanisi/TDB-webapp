// Invio push tramite APNs (Apple Push Notification service) — solo destinatari iOS.
//
// Volutamente SENZA dipendenze esterne: il provider token JWT (ES256) è firmato con
// `node:crypto` e la chiamata avviene su HTTP/2 con `node:http2` (richiesto da APNs).
// Questo modulo va importato SOLO dinamicamente (vedi lib/notifications/server.ts) e
// gira nel runtime Node.js delle route.
//
// Configurazione via env (impostare su Vercel):
//   APNS_KEY_ID       Key ID della APNs Auth Key (.p8)
//   APNS_TEAM_ID      Apple Developer Team ID
//   APNS_PRIVATE_KEY  contenuto della .p8 (i newline possono essere scritti come \n)
//   APNS_BUNDLE_ID    bundle id dell'app (default: app.tenutadelbarone.client)
//   APNS_ENV          'sandbox' per i build di sviluppo; altrimenti produzione

import { createSign } from 'node:crypto';
import http2 from 'node:http2';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { NotificationData } from '@/types/notifications';

const KEY_ID = process.env.APNS_KEY_ID?.trim() ?? '';
const TEAM_ID = process.env.APNS_TEAM_ID?.trim() ?? '';
const BUNDLE_ID = process.env.APNS_BUNDLE_ID?.trim() || 'app.tenutadelbarone.client';
const PRIVATE_KEY = (process.env.APNS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
const APNS_HOST =
  process.env.APNS_ENV?.trim() === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';

function isConfigured(): boolean {
  return Boolean(KEY_ID && TEAM_ID && PRIVATE_KEY);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Il provider token va riusato (Apple lo rifiuta se rigenerato troppo spesso e se
// più vecchio di ~1h). Lo teniamo in cache e lo rinnoviamo dopo ~50 minuti.
let cachedToken: { value: string; iat: number } | null = null;

function providerToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.iat < 3000) return cachedToken.value;

  const header = base64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
  const payload = base64url(JSON.stringify({ iss: TEAM_ID, iat: now }));
  const signingInput = `${header}.${payload}`;

  const signer = createSign('SHA256');
  signer.update(signingInput);
  const signature = signer.sign({ key: PRIVATE_KEY, dsaEncoding: 'ieee-p1363' });

  const value = `${signingInput}.${base64url(signature)}`;
  cachedToken = { value, iat: now };
  return value;
}

type ApnsResult = { token: string; status: number; reason?: string };

async function sendToTokens(tokens: string[], payload: object): Promise<ApnsResult[]> {
  const jwt = providerToken();
  const body = Buffer.from(JSON.stringify(payload));
  const client = http2.connect(APNS_HOST);
  const results: ApnsResult[] = [];

  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ':method': 'POST',
              ':path': `/3/device/${token}`,
              authorization: `bearer ${jwt}`,
              'apns-topic': BUNDLE_ID,
              'apns-push-type': 'alert',
              'content-type': 'application/json',
              'content-length': body.length,
            });

            let status = 0;
            let data = '';
            req.on('response', (headers) => {
              status = Number(headers[':status']) || 0;
            });
            req.setEncoding('utf8');
            req.on('data', (chunk) => {
              data += chunk;
            });
            req.on('end', () => {
              let reason: string | undefined;
              if (data) {
                try {
                  reason = JSON.parse(data).reason;
                } catch {
                  /* corpo non-JSON: ignora */
                }
              }
              results.push({ token, status, reason });
              resolve();
            });
            req.on('error', () => {
              results.push({ token, status: 0, reason: 'request-error' });
              resolve();
            });
            req.end(body);
          })
      )
    );
  } finally {
    client.close();
  }

  return results;
}

/**
 * Invia una push a tutti i device iOS dell'utente. No-op se APNs non è configurato
 * o se l'utente non ha token registrati. I token invalidi vengono rimossi.
 * Pensata per essere chiamata "fire and forget" (gli errori non devono bloccare
 * la creazione della notifica in-app).
 */
export async function sendApnsToUser(args: {
  userId: string;
  title: string;
  body: string;
  data?: NotificationData;
}): Promise<void> {
  if (!isConfigured()) return;

  const { data: rows, error } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('user_id', args.userId)
    .eq('platform', 'ios');

  if (error || !rows || rows.length === 0) return;

  const tokens = rows.map((row) => (row as { token: string }).token).filter(Boolean);
  if (tokens.length === 0) return;

  const payload: Record<string, unknown> = {
    aps: {
      alert: { title: args.title.trim(), body: args.body.trim() },
      sound: 'default',
      badge: 1,
    },
  };
  const href = args.data?.href;
  if (typeof href === 'string' && href) payload.href = href;

  const results = await sendToTokens(tokens, payload);

  const dead = results
    .filter((r) => r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'Unregistered')
    .map((r) => r.token);

  if (dead.length > 0) {
    await supabaseAdmin.from('push_tokens').delete().in('token', dead);
  }
}
