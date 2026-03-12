// types/services.ts
// Tipi e helper per il dominio "servizi slot-based" (asilo/addestramento/consulenza)
// e per il sistema crediti/pacchetti (service_products, service_passes).
//
// Nota: "pensione" resta su un altro dominio (bookings) e non passa da questi slot.

export type ServiceType = 'PENSIONE' | 'ASILO' | 'ADDESTRAMENTO' | 'CONSULENZA';

/**
 * service_variant serve per distinguere sottotipi dello stesso servizio.
 * - ADDESTRAMENTO: SESSION_60
 * - CONSULENZA:    SESSION_60
 * - ASILO:         HALF | FULL
 * - PENSIONE:      null (per ora)
 */
export type ServiceVariant = 'SESSION_60' | 'HALF' | 'FULL';

export type ServiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PAID'
  | 'CANCELLED'
  | 'COMPLETED';

export type PassStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';

export type TaxiPricingBand = 'LE_40KM' | 'GT_40KM';

export type TaxiPrice = {
  enabled: boolean;
  distanceKm: number | null;
  priceEur: number | null;
  band: TaxiPricingBand | null;
};

/**
 * Riga DB: public.service_products
 * Serve per mostrare l’offerta "acquisto singolo / pacchetto".
 */
export type ServiceProductRow = {
  id: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
  name: string;
  credits: number;
  price_eur: number;
  is_active: boolean;
  created_at: string;
};

/**
 * Riga DB: public.service_passes
 * È il "credito/pacchetto" posseduto dall’utente.
 */
export type ServicePassRow = {
  id: string;
  user_id: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
  product_id: string | null;

  credits_total: number;
  credits_used: number;

  status: PassStatus;
  purchased_at: string;
  expires_at: string | null;
};

/**
 * Riga DB: public.service_slots
 * Sono le disponibilità create lato gestionale.
 */
export type ServiceSlotRow = {
  id: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
  start_at: string; // timestamptz ISO
  end_at: string; // timestamptz ISO
  capacity: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

/**
 * Riga DB: public.service_slot_bookings
 * Sono le prenotazioni su slot.
 *
 * NB: nel DB esiste ancora dog_id (legacy). Da qui in avanti usiamo dog_ids.
 */
export type ServiceSlotBookingRow = {
  id: string;
  user_id: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
  slot_id: string;

  dog_ids: string[] | null; // per CONSULENZA può essere null
  pass_id: string | null;
  credits_spent: number;

  taxi_enabled: boolean;
  taxi_distance_km: number | null;
  taxi_price_eur: number | null;
  total_price: number | null;

  status: ServiceStatus;
  notes: string | null;
  created_at: string;
};

/**
 * View-model: pass singolo con crediti residui (leaf).
 * Serve nel modal, perché l'RPC book_service_slot richiede un pass_id specifico.
 */
export type ServicePassLeafSummary = {
  passId: string;
  purchasedAt: string;
  expiresAt: string | null;

  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;

  status: PassStatus;
};

/**
 * View-model: gruppo per (serviceType, serviceVariant) aggregato.
 * Serve per mostrare 1 card per servizio/variante.
 */
export type ServicePassGroupSummary = {
  groupKey: string;
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;

  creditsTotal: number;
  creditsRemaining: number;

  passes: ServicePassLeafSummary[]; // acquisti inclusi
};

export function buildPassGroupKey(serviceType: ServiceType, serviceVariant: ServiceVariant | null): string {
  return `${serviceType}::${serviceVariant ?? 'null'}`;
}

/**
 * Calcola crediti residui, con clamp a 0.
 */
export function getCreditsRemaining(total: number, used: number): number {
  const remaining = total - used;
  return remaining > 0 ? remaining : 0;
}

/**
 * Per UX: label leggibili per type/variant.
 */
export function getServiceLabel(type: ServiceType, variant: ServiceVariant | null): string {
  if (type === 'ADDESTRAMENTO') return 'Addestramento';
  if (type === 'CONSULENZA') return 'Consulenza cinofila';
  if (type === 'ASILO') {
    if (variant === 'HALF') return 'Asilo – Mezza giornata';
    if (variant === 'FULL') return 'Asilo - Intera giornata';
    return 'Asilo';
  }
  if (type === 'PENSIONE') return 'Pensione';
  return type;
}

/**
 * Regola taxi:
 * - costo basato su distanza: <= 40km => 15€, > 40km => 25€
 */
export function computeTaxiPrice(distanceKm: number): { band: TaxiPricingBand; priceEur: number } {
  if (distanceKm > 40) return { band: 'GT_40KM', priceEur: 25 };
  return { band: 'LE_40KM', priceEur: 15 };
}

/**
 * Regola: per quali servizi serve selezione cane?
 */
export function requiresDogs(type: ServiceType): boolean {
  return type === 'ASILO' || type === 'ADDESTRAMENTO';
}
