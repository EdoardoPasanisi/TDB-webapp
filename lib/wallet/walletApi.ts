// lib/wallet/walletApi.ts
import { supabase } from '@/lib/supabaseClient';

type WalletProfileRow = {
  wallet_due_eur: number | null;
};

function normalizeWalletDue(row: WalletProfileRow | null | undefined): number {
  const value = Number(row?.wallet_due_eur ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function getWalletDueEur(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_due_eur')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return normalizeWalletDue((data as WalletProfileRow | null) ?? null);
}

/**
 * Incrementa/Decrementa il wallet (debito) dell'utente.
 * Usa RPC (atomica e affidabile). Fallback a select+update solo se la RPC non esiste.
 */
export async function addToWalletDueEur(userId: string, amountEur: number): Promise<void> {
  const delta = Number(amountEur);
  if (!Number.isFinite(delta) || delta === 0) return;

  // 1) Tentativo preferito: RPC atomica
  {
    const { error } = await supabase.rpc('add_wallet_due', {
      p_user_id: userId,
      p_amount_eur: delta,
    });

    if (!error) return;

    // Se la RPC non esiste, facciamo fallback.
    const msg = error.message ?? '';
    const looksMissingFn =
      msg.includes('add_wallet_due') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('Could not find'));

    if (!looksMissingFn) {
      // Se la RPC esiste ma ha fallito, vogliamo saperlo (non silenziare).
      throw new Error(error.message);
    }
  }

  // 2) Fallback: select + update (meno affidabile, ma meglio di niente)
  const { data, error: selErr } = await supabase
    .from('profiles')
    .select('wallet_due_eur')
    .eq('user_id', userId)
    .maybeSingle();

  if (selErr) throw new Error(selErr.message);

  const current = normalizeWalletDue((data as WalletProfileRow | null) ?? null);
  const next = Math.max(0, current + delta);

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ wallet_due_eur: next })
    .eq('user_id', userId);

  if (updErr) throw new Error(updErr.message);
}
