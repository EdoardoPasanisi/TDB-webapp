// lib/services/pensione/pricing.ts

import type { AccommodationKey, TaxiDistanceBand, TaxiOption, BookingDogExtras } from '@/types/booking';

export type Euro = number;

export type DateISO = `${number}-${number}-${number}`; // "YYYY-MM-DD"

export type DogSelection = {
  dogId: string;
  accommodationType: AccommodationKey;
  extras: BookingDogExtras;
};

export type PensionePricingConfig = {
  /**
   * Prezzi alloggio in euro/giorno per tipologia.
   * Questi sono i tuoi prezzi "source of truth" attuali (li prendi da dove li hai già).
   */
  accommodationPricePerDay: Record<AccommodationKey, Euro>;

  /**
   * Prezzi extra in euro:
   * - grooming/vaccine: prezzo "una tantum" per cane
   * - tracking/fitness/walk: prezzo per sessione
   */
  extrasPricing: {
    grooming: Euro;
    vaccine: Euro;
    trackingSession: Euro;
    fitnessSession: Euro;
    walkSession: Euro;
  };

  /**
   * Prezzi taxi dog (euro) a seconda di opzione e fascia km.
   * - NONE: deve essere 0
   * - ONE_WAY: una tratta
   * - RETURN_ONLY: una tratta (ritorno)
   * - ROUND_TRIP: due tratte
   *
   * Nota: qui metti esattamente i tuoi prezzi attuali, senza inventare.
   */
  taxiPricing: Record<
    TaxiDistanceBand,
    {
      oneWay: Euro;
      roundTrip: Euro;
    }
  >;

  /**
   * Regole sconto alloggio (percentuale 0..100) in base al numero di cani.
   * Se non vuoi sconti, passa sempre 0.
   * Esempio:
   * 1 cane -> 0
   * 2 cani -> 10
   * 3+ cani -> 15
   */
  accommodationDiscountPercentByDogsCount?: (dogsCount: number) => number;
};

export type PerDogQuote = {
  dogId: string;

  accommodationType: AccommodationKey;
  accommodationPricePerDay: Euro;
  daysCount: number;

  accommodationSubtotal: Euro;
  extrasSubtotal: Euro;
  perDogTotal: Euro;

  extrasBreakdown: {
    grooming: boolean;
    vaccine: boolean;
    trackingSessions: number;
    fitnessSessions: number;
    walkSessions: number;
    therapyActive: boolean;
  };
};

export type PensioneQuote = {
  daysCount: number;

  perDog: PerDogQuote[];

  alloggioTotalFull: Euro;
  alloggioDiscountPercent: number;
  alloggioTotalDiscounted: Euro;

  extrasTotal: Euro;

  taxiPrice: Euro;

  totalPrice: Euro;
};

/**
 * Calcola giorni inclusivi o esclusivi?
 * Nel tuo progetto pensione, la logica più comune è:
 * - se start=10 e end=11 => 1 notte/1 giorno tariffabile? Dipende dal tuo pricing.
 *
 * Per evitare supposizioni: usiamo un conteggio "pernottamenti" standard:
 * daysCount = differenza giorni tra end e start (end escluso).
 * Se end non c’è o end <= start => 1
 */
export function calculateDaysCount(startDate: DateISO, endDate: DateISO | null): number {
  try {
    if (!endDate) return 1;

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // se end == start -> 0 => consideriamo 1 (minimo fatturabile)
    return Math.max(1, diffDays);
  } catch {
    return 1;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampPercent(p: number): number {
  if (Number.isNaN(p)) return 0;
  return Math.max(0, Math.min(100, p));
}

function calcExtrasSubtotal(extras: BookingDogExtras, pricing: PensionePricingConfig['extrasPricing']): Euro {
  const tracking = typeof extras.trackingSessions === 'number' ? extras.trackingSessions : 0;
  const fitness = typeof extras.fitnessSessions === 'number' ? extras.fitnessSessions : 0;
  const walk = typeof extras.walkSessions === 'number' ? extras.walkSessions : 0;

  const grooming = extras.grooming ? pricing.grooming : 0;
  const vaccine = extras.vaccine ? pricing.vaccine : 0;

  const trackingTotal = tracking > 0 ? tracking * pricing.trackingSession : 0;
  const fitnessTotal = fitness > 0 ? fitness * pricing.fitnessSession : 0;
  const walkTotal = walk > 0 ? walk * pricing.walkSession : 0;

  // therapyActive oggi non ha costo nel tuo schema (è solo informazione + note).
  // Se in futuro avrà un costo, lo aggiungiamo qui.
  const subtotal = grooming + vaccine + trackingTotal + fitnessTotal + walkTotal;

  return round2(subtotal);
}

function calcTaxiPrice(
  taxiOption: TaxiOption,
  taxiBand: TaxiDistanceBand | null,
  config: PensionePricingConfig
): Euro {
  if (taxiOption === 'NONE') return 0;
  if (!taxiBand) return 0;

  const p = config.taxiPricing[taxiBand];

  switch (taxiOption) {
    case 'ONE_WAY':
      return round2(p.oneWay);
    case 'RETURN_ONLY':
      return round2(p.oneWay);
    case 'ROUND_TRIP':
      return round2(p.roundTrip);
    default:
      return 0;
  }
}

/**
 * Calcola il preventivo completo della pensione.
 * - start_date obbligatoria
 * - end_date può essere null (in quel caso giorni = 1)
 * - dogs[] deve contenere almeno 1 cane
 */
export function calculatePensioneQuote(args: {
  startDate: DateISO;
  endDate: DateISO | null;

  dogs: DogSelection[];

  taxiOption: TaxiOption;
  taxiDistanceBand: TaxiDistanceBand | null;

  pricing: PensionePricingConfig;
}): PensioneQuote {
  const { startDate, endDate, dogs, taxiOption, taxiDistanceBand, pricing } = args;

  const daysCount = calculateDaysCount(startDate, endDate);
  const dogsCount = dogs.length;

  const discountFn = pricing.accommodationDiscountPercentByDogsCount;
  const discountPercent = clampPercent(discountFn ? discountFn(dogsCount) : 0);

  const perDog: PerDogQuote[] = dogs.map((d) => {
    const accommodationPricePerDay = pricing.accommodationPricePerDay[d.accommodationType] ?? 0;

    const accommodationSubtotal = round2(accommodationPricePerDay * daysCount);
    const extrasSubtotal = calcExtrasSubtotal(d.extras, pricing.extrasPricing);

    const perDogTotal = round2(accommodationSubtotal + extrasSubtotal);

    return {
      dogId: d.dogId,
      accommodationType: d.accommodationType,
      accommodationPricePerDay,
      daysCount,
      accommodationSubtotal,
      extrasSubtotal,
      perDogTotal,
      extrasBreakdown: {
        grooming: !!d.extras.grooming,
        vaccine: !!d.extras.vaccine,
        trackingSessions: typeof d.extras.trackingSessions === 'number' ? d.extras.trackingSessions : 0,
        fitnessSessions: typeof d.extras.fitnessSessions === 'number' ? d.extras.fitnessSessions : 0,
        walkSessions: typeof d.extras.walkSessions === 'number' ? d.extras.walkSessions : 0,
        therapyActive: !!d.extras.therapyActive,
      },
    };
  });

  const alloggioTotalFull = round2(perDog.reduce((sum, d) => sum + d.accommodationSubtotal, 0));
  const alloggioTotalDiscounted = round2(alloggioTotalFull * (1 - discountPercent / 100));

  // NB: extras non scontati (coerente col tuo schema attuale: sconto solo alloggio)
  const extrasTotal = round2(perDog.reduce((sum, d) => sum + d.extrasSubtotal, 0));

  const taxiPrice = calcTaxiPrice(taxiOption, taxiDistanceBand, pricing);

  const totalPrice = round2(alloggioTotalDiscounted + extrasTotal + taxiPrice);

  return {
    daysCount,
    perDog,
    alloggioTotalFull,
    alloggioDiscountPercent: discountPercent,
    alloggioTotalDiscounted,
    extrasTotal,
    taxiPrice,
    totalPrice,
  };
}
