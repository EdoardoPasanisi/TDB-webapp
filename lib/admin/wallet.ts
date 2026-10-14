// Registro movimenti del saldo (tabella wallet_entries, migration 20260929).
// Gli addebiti li scrivono i trigger del database; da qui lo staff legge lo storico,
// rettifica a mano, verifica le differenze emerse al passaggio al registro e annulla
// i pagamenti registrati per errore.
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
  /** Solo per le righe di un pagamento: id del pagamento e se è stato annullato. */
  paymentId: string | null;
  paymentVoided: boolean;
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
  source_type: string | null;
  source_id: string | null;
};

export async function listAdminWalletEntries(userId: string, limit = 200): Promise<AdminWalletEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('wallet_entries')
    .select('id, amount_eur, kind, label, note, created_at, reviewed_at, source_type, source_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EntryRow[];

  const paymentIds = [
    ...new Set(rows.filter((row) => row.source_type === 'PAYMENT' && row.source_id).map((row) => row.source_id as string)),
  ];
  const voided = new Set<string>();
  if (paymentIds.length) {
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('id')
      .in('id', paymentIds)
      .not('voided_at', 'is', null);
    if (paymentsError) throw new Error(paymentsError.message);
    for (const payment of (payments ?? []) as Array<{ id: string }>) voided.add(payment.id);
  }

  return rows.map((row) => {
    const paymentId = row.source_type === 'PAYMENT' ? row.source_id : null;
    return {
      id: row.id,
      amountEur: Number(row.amount_eur),
      kind: row.kind,
      label: row.label,
      note: row.note,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      paymentId,
      paymentVoided: paymentId ? voided.has(paymentId) : false,
    };
  });
}

/**
 * Annulla un pagamento registrato per errore: il pagamento resta (segnato annullato,
 * con motivo), il saldo torna al dovuto e prenotazioni/pacchetti tornano com'erano.
 * Per i pagamenti precedenti al 15/10/2026 il database non sa quali prenotazioni
 * avevano toccato (hadEffects = false): vanno ricontrollate a mano.
 */
export async function voidAdminPayment(args: {
  paymentId: string;
  reason: string;
  staffUserId: string;
}): Promise<{ restoredBookings: number; restoredPasses: number; hadEffects: boolean }> {
  const { data, error } = await supabaseAdmin.rpc('void_payment', {
    p_payment_id: args.paymentId,
    p_reason: args.reason,
    p_staff_id: args.staffUserId,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { restored_bookings?: number; restored_passes?: number; had_effects?: boolean }
    | null;
  return {
    restoredBookings: Number(row?.restored_bookings ?? 0),
    restoredPasses: Number(row?.restored_passes ?? 0),
    hadEffects: Boolean(row?.had_effects),
  };
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
