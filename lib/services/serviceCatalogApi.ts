// lib/services/serviceCatalogApi.ts
// API per leggere il catalogo prodotti servizi (service_products).
// Serve per le pagine acquisto: asilo/addestramento/consulenza.

import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';
import type { ServiceProductRow, ServiceType, ServiceVariant } from '@/types/services';

type GetProductsArgs = {
  serviceType?: ServiceType;
  serviceVariant?: ServiceVariant | null;
  onlyActive?: boolean;
};

export async function getServiceProducts(args: GetProductsArgs = {}): Promise<ServiceProductRow[]> {
  const { serviceType, serviceVariant, onlyActive = true } = args;

  let q = supabase.from('service_products').select('*');

  if (onlyActive) q = q.eq('is_active', true);
  if (serviceType) q = q.eq('service_type', serviceType);

  // variant: se lo passi esplicitamente (anche null) filtriamo
  if (typeof serviceVariant !== 'undefined') {
    if (serviceVariant === null) q = q.is('service_variant', null);
    else q = q.eq('service_variant', serviceVariant);
  }

  const { data, error } = await q.order('price_eur', { ascending: true });

  if (error) {
    throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a caricare i pacchetti disponibili.'));
  }

  return (data ?? []) as ServiceProductRow[];
}

/**
 * Helper comodo: prodotti per Addestramento.
 */
export async function getAddestramentoProducts(): Promise<ServiceProductRow[]> {
  return getServiceProducts({ serviceType: 'ADDESTRAMENTO', serviceVariant: 'SESSION_60' });
}

/**
 * Helper comodo: prodotti per Consulenza.
 */
export async function getConsulenzaProducts(): Promise<ServiceProductRow[]> {
  return getServiceProducts({ serviceType: 'CONSULENZA', serviceVariant: 'SESSION_60' });
}

/**
 * Helper comodo: prodotti Asilo (HALF o FULL)
 */
export async function getAsiloProducts(variant: 'HALF' | 'FULL'): Promise<ServiceProductRow[]> {
  return getServiceProducts({ serviceType: 'ASILO', serviceVariant: variant });
}
