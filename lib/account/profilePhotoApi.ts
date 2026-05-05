'use client';

import { extractRawErrorMessage, humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types/profile';

type ProfilePhotoResult = {
  profile: Profile | null;
  path?: string | null;
};

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.clone().json()) as unknown;
    const raw = extractRawErrorMessage(json);
    if (raw) return raw;
  } catch {}

  try {
    const rawText = String(await response.clone().text()).trim();
    if (rawText) return rawText;
  } catch {}

  return '';
}

function humanizeProfilePhotoError(raw: string, status: number): string {
  const normalized = raw.toLowerCase();

  if (status === 401) return 'Sessione non valida. Fai logout/login e riprova.';
  if (status === 403) return 'Non hai i permessi per questa operazione.';
  if (normalized.includes('file mancante')) return 'Nessun file selezionato.';
  if (
    normalized.includes('photo_path') ||
    normalized.includes('profile-images') ||
    (normalized.includes('bucket') && normalized.includes('not found'))
  ) {
    return 'Configurazione foto profilo incompleta. Applica la migration 20260424_profile_photo.sql e riprova.';
  }

  return raw
    ? humanizeErrorMessage(raw, 'Non siamo riusciti a gestire la foto profilo.')
    : `Operazione non riuscita (HTTP ${status}).`;
}

async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Sessione non valida: fai logout/login e riprova.');

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');
  return token;
}

export async function uploadProfilePhoto(file: File): Promise<ProfilePhotoResult> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/profile/photo', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const raw = await readApiErrorMessage(response);
    throw new Error(humanizeProfilePhotoError(raw, response.status));
  }

  const json = (await response.json()) as {
    ok?: boolean;
    profile?: Profile | null;
    path?: string | null;
    error?: unknown;
  };

  if (!json.ok) {
    throw new Error(humanizeProfilePhotoError(extractRawErrorMessage(json.error), 400));
  }

  return {
    profile: json.profile ?? null,
    path: json.path ?? null,
  };
}

export async function deleteProfilePhoto(): Promise<ProfilePhotoResult> {
  const token = await getAccessToken();

  const response = await fetch('/api/profile/photo', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const raw = await readApiErrorMessage(response);
    throw new Error(humanizeProfilePhotoError(raw, response.status));
  }

  const json = (await response.json()) as {
    ok?: boolean;
    profile?: Profile | null;
    error?: unknown;
  };

  if (!json.ok) {
    throw new Error(humanizeProfilePhotoError(extractRawErrorMessage(json.error), 400));
  }

  return {
    profile: json.profile ?? null,
  };
}
