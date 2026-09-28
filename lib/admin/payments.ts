import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { AdminPaymentsByTag, PaymentTag } from '@/lib/admin/types';
import { formatPersonName } from '@/lib/admin/utils';

export const PAYMENT_TAGS: PaymentTag[] = ['C', 'CC'];

export function parsePaymentTag(value: unknown): PaymentTag {
  const tag = String(value ?? '').trim().toUpperCase();
  if (tag === 'C' || tag === 'CC') return tag;
  throw new Error('Scegli C o CC per registrare il pagamento.');
}

type PaymentRow = {
  id: string;
  user_id: string;
  amount_eur: number | string | null;
  paid_at: string;
  tag: PaymentTag | null;
};

const RECENT_ITEMS_PER_TAG = 50;

/**
 * Analisi ricavi per tag: totale, ultimi 30 giorni e ultimi pagamenti di ciascuna
 * lista (C / CC). I pagamenti precedenti all'introduzione dei tag restano a parte.
 */
export async function listAdminPaymentsByTag(): Promise<AdminPaymentsByTag> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, amount_eur, paid_at, tag')
    .order('paid_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as PaymentRow[];
  const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const recentUserIds = new Set<string>();
  for (const tag of PAYMENT_TAGS) {
    rows
      .filter((row) => row.tag === tag)
      .slice(0, RECENT_ITEMS_PER_TAG)
      .forEach((row) => recentUserIds.add(row.user_id));
  }

  const names = new Map<string, string>();
  if (recentUserIds.size) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .in('user_id', [...recentUserIds]);
    for (const profile of (profiles ?? []) as Array<{
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>) {
      names.set(profile.user_id, formatPersonName(profile.first_name, profile.last_name, profile.email));
    }
  }

  const amount = (row: PaymentRow) => Number(row.amount_eur ?? 0) || 0;
  const round = (value: number) => Math.round(value * 100) / 100;

  const untaggedRows = rows.filter((row) => !row.tag);

  return {
    tags: PAYMENT_TAGS.map((tag) => {
      const tagged = rows.filter((row) => row.tag === tag);
      return {
        tag,
        totalEur: round(tagged.reduce((sum, row) => sum + amount(row), 0)),
        last30DaysEur: round(
          tagged
            .filter((row) => new Date(row.paid_at).getTime() >= since30)
            .reduce((sum, row) => sum + amount(row), 0)
        ),
        count: tagged.length,
        items: tagged.slice(0, RECENT_ITEMS_PER_TAG).map((row) => ({
          id: row.id,
          userId: row.user_id,
          customerName: names.get(row.user_id) ?? 'Cliente',
          amountEur: amount(row),
          paidAt: row.paid_at,
        })),
      };
    }),
    untagged: {
      totalEur: round(untaggedRows.reduce((sum, row) => sum + amount(row), 0)),
      count: untaggedRows.length,
    },
  };
}
