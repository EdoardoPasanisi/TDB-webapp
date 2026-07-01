'use client';

import { supabase } from '@/lib/supabaseClient';
import { compressImageFile } from '@/lib/uploads/imageCompression';
import type { Profile } from '@/types/profile';

type UserDocumentKind = 'ID_DOCUMENT' | 'WAIVER_SIGNED';
type DocumentSide = 'FRONT' | 'BACK';

type UploadUserDocumentResult = {
  path: string;
  profile: Profile | null;
};

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.clone().json()) as { error?: string; message?: string };
    const raw = String(json?.error ?? json?.message ?? '').trim();
    if (raw) return raw;
  } catch {}

  try {
    const rawText = String(await response.clone().text()).trim();
    if (rawText) return rawText;
  } catch {}

  return '';
}

function humanizeDocumentUploadError(raw: string, status: number): string {
  const normalized = raw.toLowerCase();

  if (status === 401) return 'Sessione non valida. Fai logout/login e riprova.';
  if (status === 403) return 'Non hai i permessi per questa operazione.';
  if (status === 413) return 'Il file è troppo grande. Riprova con un file più leggero (max 10MB).';
  if (normalized.includes('file mancante')) return 'Nessun file selezionato.';
  if (normalized.includes('tipo documento non valido')) return 'Tipo documento non valido.';

  return raw ? `Operazione non riuscita: ${raw}` : `Operazione non riuscita (HTTP ${status}).`;
}

async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Sessione non valida: fai logout/login e riprova.');

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');
  return token;
}

type PreparedUpload = {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
};

// Chiede alla API un URL firmato e carica il file DIRETTAMENTE su Supabase
// Storage, così i byte non passano dalla serverless (niente limite ~4,5MB).
// Ritorna lo storage path da registrare in fase di "complete".
async function uploadFileDirect(args: {
  authToken: string;
  kind: UserDocumentKind;
  file: File;
}): Promise<string> {
  const { authToken, kind, file } = args;

  const prepareResponse = await fetch('/api/user-documents/upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ kind, mimeType: file.type, size: file.size }),
  });

  if (!prepareResponse.ok) {
    const rawError = await readApiErrorMessage(prepareResponse);
    throw new Error(humanizeDocumentUploadError(rawError, prepareResponse.status));
  }

  const { upload } = (await prepareResponse.json()) as { upload?: PreparedUpload };
  if (!upload?.signedUrl || !upload?.path || !upload?.token) {
    throw new Error('Preparazione del caricamento non riuscita. Riprova.');
  }

  const { error: uploadError } = await supabase.storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.path, upload.token, file, {
      contentType: file.type || 'application/octet-stream',
    });

  if (uploadError) {
    throw new Error('Caricamento del file non riuscito. Controlla la connessione e riprova.');
  }

  return upload.path;
}

async function finalizeDocuments(args: {
  authToken: string;
  kind: UserDocumentKind;
  sides: Array<{ side: DocumentSide | null; path: string }>;
}): Promise<{ frontPath: string | null; backPath: string | null; profile: Profile | null }> {
  const response = await fetch('/api/user-documents/complete', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ kind: args.kind, sides: args.sides }),
  });

  if (!response.ok) {
    const rawError = await readApiErrorMessage(response);
    throw new Error(humanizeDocumentUploadError(rawError, response.status));
  }

  const json = (await response.json()) as {
    ok?: boolean;
    frontPath?: string | null;
    backPath?: string | null;
    profile?: Profile | null;
    error?: string;
  };

  if (!json.ok) {
    throw new Error(humanizeDocumentUploadError(String(json.error ?? ''), 400));
  }

  return {
    frontPath: json.frontPath ?? null,
    backPath: json.backPath ?? null,
    profile: json.profile ?? null,
  };
}

export async function uploadUserDocument(args: {
  kind: UserDocumentKind;
  file: File;
}): Promise<UploadUserDocumentResult> {
  const authToken = await getAccessToken();
  const file = await compressImageFile(args.file);

  const path = await uploadFileDirect({ authToken, kind: args.kind, file });
  const { profile } = await finalizeDocuments({
    authToken,
    kind: args.kind,
    sides: [{ side: null, path }],
  });

  return { path, profile };
}

type UploadIdentitySidesResult = {
  frontPath: string | null;
  backPath: string | null;
  profile: Profile | null;
};

export async function uploadIdentityDocumentSides(args: {
  front?: File | null;
  back?: File | null;
}): Promise<UploadIdentitySidesResult> {
  const { front, back } = args;

  if (!front && !back) {
    throw new Error('Nessun file selezionato.');
  }

  const authToken = await getAccessToken();
  const sides: Array<{ side: DocumentSide; path: string }> = [];

  // Carichiamo un lato alla volta: ogni file è una richiesta separata verso
  // Supabase, così due foto insieme non sommano più i byte in un'unica richiesta.
  for (const [side, rawFile] of [
    ['FRONT', front],
    ['BACK', back],
  ] as const) {
    if (!rawFile) continue;
    const file = await compressImageFile(rawFile);
    const path = await uploadFileDirect({ authToken, kind: 'ID_DOCUMENT', file });
    sides.push({ side, path });
  }

  const { frontPath, backPath, profile } = await finalizeDocuments({
    authToken,
    kind: 'ID_DOCUMENT',
    sides,
  });

  return { frontPath, backPath, profile };
}
