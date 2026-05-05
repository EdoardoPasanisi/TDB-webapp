// lib/services/servicePassesApi.ts
// API per leggere e acquistare i pass (crediti/pacchetti) dell’utente.

import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';
import type {
  ServicePassRow,
  ServicePassGroupSummary,
  ServicePassLeafSummary,
} from '@/types/services';
import { buildPassGroupKey, getCreditsRemaining } from '@/types/services';

export async function getUserServicePasses(userId: string): Promise<ServicePassRow[]> {
  const { data, error } = await supabase
    .from('service_passes')
    .select('*')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });

  if (error) throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a caricare i tuoi crediti.'));
  return (data ?? []) as ServicePassRow[];
}

/**
 * Raggruppa i pass ACTIVE per (service_type, service_variant).
 * UI: 1 card per servizio/variante, ma nel modal scegliamo quale pass usare (RPC richiede pass_id).
 */
export function buildPassSummaries(passes: ServicePassRow[]): ServicePassGroupSummary[] {
  const active = passes.filter((p) => p.status === 'ACTIVE');

  const map = new Map<string, ServicePassGroupSummary>();

  for (const p of active) {
    const remaining = getCreditsRemaining(p.credits_total, p.credits_used);
    if (remaining <= 0) continue;

    const leaf: ServicePassLeafSummary = {
      passId: p.id,
      purchasedAt: p.purchased_at,
      expiresAt: p.expires_at,

      creditsTotal: p.credits_total,
      creditsUsed: p.credits_used,
      creditsRemaining: remaining,

      status: p.status,
    };

    const key = buildPassGroupKey(p.service_type, p.service_variant);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        groupKey: key,
        serviceType: p.service_type,
        serviceVariant: p.service_variant,
        creditsTotal: leaf.creditsTotal,
        creditsRemaining: leaf.creditsRemaining,
        passes: [leaf],
      });
    } else {
      existing.creditsTotal += leaf.creditsTotal;
      existing.creditsRemaining += leaf.creditsRemaining;
      existing.passes.push(leaf);
    }
  }

  // Ordine coerente: gruppi con più crediti prima, e dentro gruppo acquisti più vecchi prima (così consumi “in ordine”)
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.passes.sort((a, b) => new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime());
  }
  groups.sort((a, b) => b.creditsRemaining - a.creditsRemaining);

  return groups;
}

/**
 * Acquisto pass atomico lato DB:
 * - valida il prodotto server-side
 * - crea il pass
 * - aggiorna il wallet
 */
export async function purchasePassFromProduct(productId: string): Promise<ServicePassRow> {
  const normalizedProductId = String(productId ?? '').trim();
  if (!normalizedProductId) {
    throw new Error('Prodotto non valido.');
  }

  const { data, error } = await supabase.rpc('purchase_service_pass', {
    p_product_id: normalizedProductId,
  });

  if (error) {
    const msg = error.message ?? '';
    const looksMissingFn =
      msg.includes('purchase_service_pass') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('Could not find'));

    if (looksMissingFn) {
      throw new Error('Database non aggiornato: applica le ultime migration Supabase.');
    }

    throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a completare l’acquisto del pacchetto.'));
  }

  return data as ServicePassRow;
}
