'use client';

import { extractRawErrorMessage, humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';

async function getAccessToken(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Sessione non valida: fai logout/login e riprova.');

  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Token mancante: fai logout/login e riprova.');
  return token;
}

/**
 * Richiede l'eliminazione definitiva dell'account dell'utente corrente.
 * Lato server cancella tutti i dati personali e l'utente auth; il chiamante
 * deve poi eseguire supabase.auth.signOut() e reindirizzare al login.
 */
export async function deleteCurrentUserAccount(): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch('/api/account', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let raw = '';
    try {
      const json = (await response.clone().json()) as unknown;
      raw = extractRawErrorMessage(json);
    } catch {}

    throw new Error(
      raw
        ? humanizeErrorMessage(raw, 'Non siamo riusciti a eliminare l’account.')
        : `Eliminazione non riuscita (HTTP ${response.status}).`
    );
  }
}
