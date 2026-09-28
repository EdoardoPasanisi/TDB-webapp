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

// Il saldo si modifica solo lato server: gli addebiti seguono i servizi tramite il
// registro movimenti (wallet_entries). Dal client si legge soltanto.
