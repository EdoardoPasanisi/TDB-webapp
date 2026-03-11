// lib/services/servicePassesApi.ts
// API per leggere e creare i pass (crediti/pacchetti) dell’utente.
// In MVP: "acquisto simulato" = insert su service_passes.

import { supabase } from '@/lib/supabaseClient';
import type {
  ServicePassRow,
  ServicePassGroupSummary,
  ServicePassLeafSummary,
  ServiceProductRow,
  ServiceType,
  ServiceVariant,
} from '@/types/services';
import { buildPassGroupKey, getCreditsRemaining } from '@/types/services';
import { addToWalletDueEur } from '@/lib/wallet/walletApi';

export async function getUserServicePasses(userId: string): Promise<ServicePassRow[]> {
  const { data, error } = await supabase
    .from('service_passes')
    .select('*')
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });

  if (error) throw new Error(error.message);
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
 * Acquisto simulato: crea un pass a partire da un prodotto.
 * In futuro sostituiremo questo con Stripe webhook -> insert server-side.
 *
 * Wallet: ogni acquisto aumenta il debito (wallet_due_eur) dell'utente.
 */
export async function purchasePassFromProduct(args: {
  userId: string;
  product: ServiceProductRow;
  expiresAtIso?: string | null;
}): Promise<ServicePassRow> {
  const { userId, product, expiresAtIso = null } = args;

  const insertPayload = {
    user_id: userId,
    service_type: product.service_type as ServiceType,
    service_variant: product.service_variant as ServiceVariant | null,
    product_id: product.id,
    credits_total: product.credits,
    credits_used: 0,
    status: 'ACTIVE',
    expires_at: expiresAtIso,
  };

  const { data, error } = await supabase.from('service_passes').insert(insertPayload).select('*').single();
  if (error) throw new Error(error.message);

  // Wallet increment (best effort ma NON silenzioso: se fallisce vogliamo accorgercene)
  const price = Number(product.price_eur);
  if (Number.isFinite(price) && price > 0) {
    await addToWalletDueEur(userId, price);
  }

  return data as ServicePassRow;
}
