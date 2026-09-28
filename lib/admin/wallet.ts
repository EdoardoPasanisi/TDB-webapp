// Registro movimenti del saldo (tabella wallet_entries, migration 20260929).
// Gli addebiti li scrivono i trigger del database; da qui lo staff legge lo storico,
// rettifica a mano, verifica le differenze emerse al passaggio al registro e ripulisce
// i pagamenti di prova (tag C).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { formatPersonName } from '@/lib/admin/utils';

export type WalletEntryKind = 'CHARGE' | 'PAYMENT' | 'DISCOUNT' | 'ADJUSTMENT' | 'OPENING';

export type AdminWalletEntry = {
  id: string;
  amountEur: number;
  kind: WalletEntryKind;
  label: string;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminWalletReviewItem = {
  entryId: string;
  userId: string;
  customerName: string;
  amountEur: number;
  note: string | null;
  currentBalanceEur: number;
};

type EntryRow = {
  id: string;
  amount_eur: number | string;
  kind: WalletEntryKind;
  label: string;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function listAdminWalletEntries(userId: string, limit = 200): Promise<AdminWalletEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('wallet_entries')
    .select('id, amount_eur, kind, label, note, created_at, reviewed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as EntryRow[]).map((row) => ({
    id: row.id,
    amountEur: Number(row.amount_eur),
    kind: row.kind,
    label: row.label,
    note: row.note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
}

export async function adjustAdminWallet(args: {
  userId: string;
  amountEur: number;
  note: string;
  staffUserId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc('wallet_adjust', {
    p_user_id: args.userId,
    p_amount_eur: args.amountEur,
    p_note: args.note,
    p_staff_id: args.staffUserId,
  });
  if (error) throw new Error(error.message);
}

/** Differenze emerse al passaggio al registro, non ancora verificate dallo staff. */
export async function listAdminWalletReview(): Promise<AdminWalletReviewItem[]> {
  const { data, error } = await supabaseAdmin
    .from('wallet_entries')
    .select('id, user_id, amount_eur, note')
    .eq('kind', 'OPENING')
    .is('reviewed_at', null)
    .order('amount_eur', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ id: string; user_id: string; amount_eur: number | string; note: string | null }>;
  if (rows.length === 0) return [];

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('user_id, first_name, last_name, email, wallet_due_eur')
    .in('user_id', rows.map((row) => row.user_id));
  const byId = new Map(
    ((profiles ?? []) as Array<{
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      wallet_due_eur: number | null;
    }>).map((profile) => [profile.user_id, profile])
  );

  return rows.map((row) => {
    const profile = byId.get(row.user_id);
    return {
      entryId: row.id,
      userId: row.user_id,
      customerName: formatPersonName(profile?.first_name, profile?.last_name, profile?.email) || 'Cliente',
      amountEur: Number(row.amount_eur),
      note: row.note,
      currentBalanceEur: Number(profile?.wallet_due_eur ?? 0),
    };
  });
}

export async function reviewAdminWalletOpening(args: {
  entryId: string;
  applyCorrection: boolean;
  staffUserId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc('wallet_review_opening', {
    p_entry_id: args.entryId,
    p_apply_correction: args.applyCorrection,
    p_staff_id: args.staffUserId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Elimina tutti i pagamenti di prova (tag C) e i loro movimenti: i saldi tornano come
 * se non fossero mai stati registrati. Nel database resta una riga di log con data,
 * operatore, quantità e totale.
 */
export async function deleteAdminTestPayments(staffUserId: string): Promise<{ count: number; totalEur: number }> {
  const { data, error } = await supabaseAdmin.rpc('delete_tagged_payments', {
    p_tag: 'C',
    p_staff_id: staffUserId,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { deleted_count?: number; deleted_total?: number } | null;
  return { count: Number(row?.deleted_count ?? 0), totalEur: Number(row?.deleted_total ?? 0) };
}
