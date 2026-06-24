'use client';

import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types/profile';

type UserDocumentKind = 'ID_DOCUMENT' | 'WAIVER_SIGNED';

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
  if (normalized.includes('file mancante')) return 'Nessun file selezionato.';
  if (normalized.includes('tipo documento non valido')) return 'Tipo documento non valido.';

  return raw ? `Operazione non riuscita: ${raw}` : `Operazione non riuscita (HTTP ${status}).`;
}

export async function uploadUserDocument(args: {
  kind: UserDocumentKind;
  file: File;
}): Promise<UploadUserDocumentResult> {
  const { kind, file } = args;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Sessione non valida: fai logout/login e riprova.');

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');

  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file);

  const response = await fetch('/api/user-documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const rawError = await readApiErrorMessage(response);
    throw new Error(humanizeDocumentUploadError(rawError, response.status));
  }

  const json = (await response.json()) as {
    ok?: boolean;
    path?: string;
    profile?: Profile | null;
    error?: string;
  };

  if (!json.ok || !json.path) {
    throw new Error(humanizeDocumentUploadError(String(json.error ?? ''), 400));
  }

  return {
    path: json.path,
    profile: json.profile ?? null,
  };
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

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Sessione non valida: fai logout/login e riprova.');

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');

  const formData = new FormData();
  formData.append('kind', 'ID_DOCUMENT');
  if (front) formData.append('front', front);
  if (back) formData.append('back', back);

  const response = await fetch('/api/user-documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
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
