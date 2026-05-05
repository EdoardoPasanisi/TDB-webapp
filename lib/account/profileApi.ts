'use client';

import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types/profile';

type ProfileCardPreferences = Pick<
  Profile,
  | 'show_first_name_on_dog_card'
  | 'show_last_name_on_dog_card'
  | 'show_phone_on_dog_card'
  | 'show_email_on_dog_card'
  | 'show_address_on_dog_card'
  | 'show_dog_address_on_dog_card'
>;

async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Sessione non valida: fai logout/login e riprova.');

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');
  return token;
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.clone().json()) as { error?: string; message?: string };
    const raw = String(json?.error ?? json?.message ?? '').trim();
    if (raw) return raw;
  } catch {}

  try {
    const text = String(await response.clone().text()).trim();
    if (text) return text;
  } catch {}

  return '';
}

function humanizeProfileError(raw: string, status: number): string {
  if (status === 401) return 'Sessione non valida. Fai logout/login e riprova.';
  if (status === 403) return 'Non hai i permessi per questa operazione.';

  return raw ? `Operazione non riuscita: ${raw}` : `Operazione non riuscita (HTTP ${status}).`;
}

async function patchJson<T>(url: string, body: object): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const raw = await readApiErrorMessage(response);
    throw new Error(humanizeProfileError(raw, response.status));
  }

  return (await response.json()) as T;
}

export async function updateProfileForCurrentUser(payload: object): Promise<Profile> {
  return patchJson<Profile>('/api/profile', payload);
}

export async function updateProfileCardPreferencesForCurrentUser(
  payload: ProfileCardPreferences
): Promise<Profile> {
  return patchJson<Profile>('/api/profile/card-preferences', payload);
}
