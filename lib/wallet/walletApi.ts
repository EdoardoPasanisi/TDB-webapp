// lib/wallet/walletApi.ts
import { supabase } from '@/lib/supabaseClient';
import { humanizeErrorMessage } from '@/lib/errors/humanize';

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

  if (error) throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a leggere il saldo.'));

  return normalizeWalletDue((data as WalletProfileRow | null) ?? null);
}

/**
 * Incrementa/Decrementa il wallet (debito) dell'utente loggato tramite RPC.
 */
export async function addToWalletDueEur(amountEur: number): Promise<void> {
  const delta = Number(amountEur);
  if (!Number.isFinite(delta) || delta === 0) return;

  const { error } = await supabase.rpc('add_wallet_due', {
    p_amount_eur: delta,
  });

  if (error) {
    const msg = error.message ?? '';
    const looksMissingFn =
      msg.includes('add_wallet_due') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('Could not find'));

    if (looksMissingFn) {
      throw new Error('Database non aggiornato: applica le ultime migration Supabase.');
    }

    throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti ad aggiornare il saldo.'));
  }
}
