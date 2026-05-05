'use client';

import { supabase } from '@/lib/supabaseClient';
import type { NotificationPreferences } from '@/types/notificationPreferences';

async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Sessione non valida: fai logout/login e riprova.');
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');
  return token;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = String(await response.text().catch(() => '')).trim();
    throw new Error(message || `Operazione non riuscita (HTTP ${response.status}).`);
  }

  return (await response.json()) as T;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return requestJson<NotificationPreferences>('/api/notification-preferences', {
    method: 'GET',
  });
}

export async function updateNotificationPreferences(
  patch: Partial<Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<NotificationPreferences> {
  return requestJson<NotificationPreferences>('/api/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
