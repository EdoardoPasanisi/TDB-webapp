'use client';

import { supabase } from '@/lib/supabaseClient';

/**
 * Restituisce true se l'utente ha già completato (o saltato) il tutorial onboarding.
 * In caso di errore di rete restituisce `null` (stato sconosciuto) così il chiamante
 * può decidere di NON avviare il tour piuttosto che mostrarlo per sbaglio.
 */
export async function hasCompletedTutorial(userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('tutorial_completed_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return null;

    return Boolean(data?.tutorial_completed_at);
  } catch {
    return null;
  }
}

/** Segna il tutorial come completato/saltato per l'utente corrente (best-effort). */
export async function markTutorialCompleted(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return false;

    const response = await fetch('/api/profile/tutorial', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.ok;
  } catch {
    return false;
  }
}
