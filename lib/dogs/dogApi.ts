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
  const { data, error } = await supabase
    .from('dogs')
    .insert({
      owner_id: ownerId,

      name: input.name.trim(),
      breed: input.breed,

      size_category: input.size_category,
      grooming_difficulty: input.grooming_difficulty,

      // ✅ new
      sex: input.sex,

      microchip: input.microchip,
      birth_date: input.birth_date,
      notes: input.notes,

      // ✅ new
      coat_color: input.coat_color,
      temperament: input.temperament,

      // Toggles
      show_breed: input.show_breed,
      show_sex: input.show_sex,
      show_size: input.show_size,
      show_microchip: input.show_microchip,
      show_birth_date: input.show_birth_date,
      show_notes: input.show_notes,
      show_coat_color: input.show_coat_color,
      show_temperament: input.show_temperament,
    })
    .select(DOG_SELECT)
    .single();

  if (error || !data) {
    console.error('createDogForOwner – errore:', error);
    throw error;
  }

  return data as Dog;
}

export async function updateDogForOwner(dogId: string, ownerId: string, input: DogInput): Promise<Dog> {
  const { data, error } = await supabase
    .from('dogs')
    .update({
      name: input.name.trim(),
      breed: input.breed,

      size_category: input.size_category,
      grooming_difficulty: input.grooming_difficulty,

      // ✅ new
      sex: input.sex,

      microchip: input.microchip,
      birth_date: input.birth_date,
      notes: input.notes,

      // ✅ new
      coat_color: input.coat_color,
      temperament: input.temperament,

      // Toggles
      show_breed: input.show_breed,
      show_sex: input.show_sex,
      show_size: input.show_size,
      show_microchip: input.show_microchip,
      show_birth_date: input.show_birth_date,
      show_notes: input.show_notes,
      show_coat_color: input.show_coat_color,
      show_temperament: input.show_temperament,
    })
    .eq('id', dogId)
    .eq('owner_id', ownerId)
    .select(DOG_SELECT)
    .single();

  if (error || !data) {
    console.error('updateDogForOwner – errore:', error);
    throw error;
  }

  return data as Dog;
}

export async function softDeleteDogForOwner(dogId: string, ownerId: string): Promise<void> {
  const { error } = await supabase
    .from('dogs')
    .update({ is_active: false })
    .eq('id', dogId)
    .eq('owner_id', ownerId);

  if (error) {
    console.error('softDeleteDogForOwner – errore:', error);
    throw error;
  }
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
  ownerId: string;
  dogId: string;
  file: File;
}): Promise<string> {
  const { dogId, file } = args;

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw new Error('Sessione non valida: fai logout/login e riprova.');
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');

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

export async function setDogPhotoPathForOwner(args: {
  ownerId: string;
  dogId: string;
  photoPath: string | null;
}): Promise<Dog> {
  const { ownerId, dogId, photoPath } = args;

  const { data, error } = await supabase
    .from('dogs')
    .update({ photo_path: photoPath })
    .eq('id', dogId)
    .eq('owner_id', ownerId)
    .select(DOG_SELECT)
    .single();

  if (error || !data) {
    console.error('setDogPhotoPathForOwner – errore:', error);
    throw error ?? new Error('Impossibile salvare foto cane.');
  }

  return data as Dog;
}

export async function removeDogPhotoForOwner(args: { dogId: string }): Promise<void> {
  const { dogId } = args;

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw new Error('Sessione non valida: fai logout/login e riprova.');
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');

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
