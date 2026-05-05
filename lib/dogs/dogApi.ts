// lib/dogs/dogApi.ts
'use client';

import { supabase } from '@/lib/supabaseClient';
import type { Dog, DogInput } from '@/types/dog';

const DOG_SELECT =
  'id, owner_id, created_at, updated_at, name, breed, size_category, grooming_difficulty, sex, microchip, birth_date, notes, coat_color, temperament, photo_path, is_active, public_id, show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes, show_coat_color, show_temperament' as const;

export async function getDogByIdForOwner(dogId: string, ownerId: string): Promise<Dog | null> {
  const { data, error } = await supabase
    .from('dogs')
    .select(DOG_SELECT)
    .eq('id', dogId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    console.error('getDogByIdForOwner – errore:', error);
    throw error;
  }

  if (!data || data.is_active === false) return null;
  return data as Dog;
}

export async function createDogForOwner(ownerId: string, input: DogInput): Promise<Dog> {
  void ownerId;
  return requestDogMutation<Dog>('/api/dogs', 'POST', input);
}

export async function updateDogForOwner(dogId: string, ownerId: string, input: DogInput): Promise<Dog> {
  void ownerId;
  return requestDogMutation<Dog>(`/api/dogs/${dogId}`, 'PATCH', input);
}

export async function softDeleteDogForOwner(dogId: string, ownerId: string): Promise<void> {
  void ownerId;
  await requestDogMutation(`/api/dogs/${dogId}`, 'DELETE');
}

export async function updateDogVisibilityForOwner(
  dogId: string,
  ownerId: string,
  visibility: Pick<
    Dog,
    | 'show_breed'
    | 'show_sex'
    | 'show_size'
    | 'show_microchip'
    | 'show_birth_date'
    | 'show_notes'
    | 'show_coat_color'
    | 'show_temperament'
  >
): Promise<Dog> {
  void ownerId;
  return requestDogMutation<Dog>(`/api/dogs/${dogId}/visibility`, 'PATCH', visibility);
}

// =======================
// ✅ DOG PHOTO (soft start)
// =======================

async function readApiErrorMessage(res: Response): Promise<string> {
  // Proviamo prima JSON { error: "..." }
  try {
    const json = (await res.clone().json()) as { error?: string; message?: string };
    const raw = String(json?.error ?? json?.message ?? '').trim();
    if (raw) return raw;
  } catch {}

  // Poi fallback testo
  try {
    const t = String(await res.clone().text()).trim();
    if (t) return t;
  } catch {}

  return '';
}

async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw new Error('Sessione non valida: fai logout/login e riprova.');

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');
  return token;
}

function humanizeDogMutationError(raw: string, status: number): string {
  const s = raw.toLowerCase();

  if (status === 401) return 'Sessione non valida. Fai logout/login e riprova.';
  if (status === 403) return 'Non hai i permessi per questa operazione.';
  if (status === 404) return 'Cane non trovato.';
  if (s.includes('payload cane non valido')) return 'Dati cane non validi.';
  if (s.includes('nome cane mancante')) return 'Nome cane mancante.';

  return raw ? `Operazione non riuscita: ${raw}` : `Operazione non riuscita (HTTP ${status}).`;
}

async function requestDogMutation<T = void>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const raw = await readApiErrorMessage(res);
    throw new Error(humanizeDogMutationError(raw, res.status));
  }

  if (method === 'DELETE') {
    return undefined as T;
  }

  return (await res.json()) as T;
}

function humanizeDogPhotoError(raw: string, status: number): string {
  const s = raw.toLowerCase();

  if (status === 401) return 'Sessione non valida. Fai logout/login e riprova.';
  if (status === 403) return 'Non hai i permessi per modificare questo cane.';
  if (status === 404) return 'Cane non trovato.';
  if (s.includes('missing file')) return 'Nessuna foto selezionata.';
  if (s.includes('missing dogid')) return 'Errore interno: cane non riconosciuto.';
  if (s.includes('invalid session')) return 'Sessione non valida. Fai logout/login e riprova.';
  if (s.includes('forbidden')) return 'Non hai i permessi per questa operazione.';

  // Default “umano”
  return raw
    ? `Operazione non riuscita: ${raw}`
    : `Operazione non riuscita (HTTP ${status}).`;
}

export async function uploadDogPhotoForOwner(args: {
  dogId: string;
  file: File;
}): Promise<string> {
  const { dogId, file } = args;

  const token = await getAccessToken();

  const fd = new FormData();
  fd.append('dogId', dogId);
  fd.append('file', file);

  const res = await fetch('/api/dog-photo', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: fd,
  });

  if (!res.ok) {
    const raw = await readApiErrorMessage(res);
    throw new Error(humanizeDogPhotoError(raw, res.status));
  }

  const json = (await res.json()) as { ok: boolean; path?: string; error?: string };
  if (!json.ok || !json.path) {
    throw new Error(humanizeDogPhotoError(String(json.error ?? ''), 400));
  }

  return json.path;
}

export async function removeDogPhotoForOwner(args: { dogId: string }): Promise<void> {
  const { dogId } = args;

  const token = await getAccessToken();

  const res = await fetch('/api/dog-photo', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ dogId }),
  });

  if (!res.ok) {
    const raw = await readApiErrorMessage(res);
    throw new Error(humanizeDogPhotoError(raw, res.status));
  }
}
