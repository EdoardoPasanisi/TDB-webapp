// lib/services/pensione/constants.ts
import type { AccommodationKey, TaxiDistanceBand } from '@/types/booking';
import type { DogSize, WashDifficulty } from '@/data/dogBreeds';
import type { PetSpecies } from '@/types/dog';

export const DEFAULT_TIMES = {
  ARRIVAL: '10:00',
  DEPARTURE: '10:00',
} as const;

export const DEFAULT_TAXI = {
  option: 'NONE' as const,
  distanceBand: 'ENTRO_40' as const,
};

/**
 * Prezzi alloggi: tariffa TOTALE €/giorno in base al numero di cani dello stesso
 * proprietario nella prenotazione [1 cane, 2 cani, 3+ cani].
 *
 * È lo sconto "multi-cane": chi porta più cani paga meno a testa. La tariffa
 * per singolo cane si ottiene dividendo il totale del tier per il numero di cani
 * (con cap a 3): vedi accommodationPricePerDay().
 *
 * NB: il tier con indice 2 (3 cani) vale anche per 4+ cani → oltre il terzo cane
 * la tariffa/cane resta quella del tier "3".
 */
export const ACCOMMODATION_TIER_PRICES: Record<AccommodationKey, [number, number, number]> = {
  BOX: [28, 45, 60],
  BOX_GARDEN: [35, 60, 90],
  CHALET: [35, 60, 90],
  APT_GARDEN: [50, 90, 120],
  // Non forniti dallo staff: derivati con i rapporti dell'Appartamento (×1.8 / ×2.4).
  APT_GARDEN_NIGHT_PERSON: [100, 180, 240],
  HOTEL: [45, 80, 110],
  CATTERY: [25, 45, 60],
};

/**
 * Tariffa alloggio €/giorno PER SINGOLO CANE, dato il numero totale di cani del
 * proprietario nella prenotazione. Il totale del gruppo si ottiene moltiplicando
 * per il numero di cani in quell'alloggio.
 */
export function accommodationPricePerDay(type: AccommodationKey, totalDogs: number): number {
  const tier = Math.min(Math.max(Math.floor(totalDogs) || 1, 1), 3); // 1, 2, 3
  const total = ACCOMMODATION_TIER_PRICES[type][tier - 1];
  return Math.round((total / tier) * 100) / 100;
}

// Prezzi alloggi (etichette + prezzo di riferimento a 1 cane, es. liste "a partire da")
export const ACCOMMODATION_PRICES: Record<
  AccommodationKey,
  { label: string; pricePerDay: number }
> = {
  BOX: { label: 'Box', pricePerDay: ACCOMMODATION_TIER_PRICES.BOX[0] },
  BOX_GARDEN: { label: 'Box con giardino', pricePerDay: ACCOMMODATION_TIER_PRICES.BOX_GARDEN[0] },
  CHALET: { label: 'Chalet', pricePerDay: ACCOMMODATION_TIER_PRICES.CHALET[0] },
  APT_GARDEN: {
    label: 'Appartamento con giardino',
    pricePerDay: ACCOMMODATION_TIER_PRICES.APT_GARDEN[0],
  },
  APT_GARDEN_NIGHT_PERSON: {
    label: 'Appartamento con giardino (presenza notturna)',
    pricePerDay: ACCOMMODATION_TIER_PRICES.APT_GARDEN_NIGHT_PERSON[0],
  },
  HOTEL: {
    label: 'Hotel - stanza luxury con giardino e aria condizionata',
    pricePerDay: ACCOMMODATION_TIER_PRICES.HOTEL[0],
  },
  CATTERY: { label: 'Gattile', pricePerDay: ACCOMMODATION_TIER_PRICES.CATTERY[0] },
};

// Alloggi disponibili per specie: i cani non possono usare il gattile, i gatti solo
// il gattile, "altro" non è prenotabile in pensione (nessuna opzione).
export function accommodationOptionsForSpecies(species: PetSpecies): AccommodationKey[] {
  if (species === 'CAT') return ['CATTERY'];
  if (species === 'OTHER') return [];
  return (Object.keys(ACCOMMODATION_PRICES) as AccommodationKey[]).filter((key) => key !== 'CATTERY');
}

export function defaultAccommodationForSpecies(species: PetSpecies): AccommodationKey {
  return species === 'CAT' ? 'CATTERY' : 'BOX';
}

// Prezzi taxi in base alla distanza
export const TAXI_PRICES_WITH_DISTANCE: Record<
  TaxiDistanceBand,
  { ONE_WAY: number; RETURN_ONLY: number; ROUND_TRIP: number }
> = {
  ENTRO_40: { ONE_WAY: 40, RETURN_ONLY: 40, ROUND_TRIP: 60 },
  OLTRE_40: { ONE_WAY: 50, RETURN_ONLY: 50, ROUND_TRIP: 70 },
};

// Prezzi extra “semplici”
// NB: la chiave interna TRACKING è mantenuta per compatibilità con le prenotazioni
// già salvate; corrisponde al servizio “Ricerca olfattiva” (15 min).
export const EXTRA_PRICES = {
  VACCINE: 70,
  TRACKING: 20, // Ricerca olfattiva (15 min)
  FITNESS: 25,
  WALK: 15,
  TREKKING: 30, // Trekking in campagna (45 min)
} as const;

/**
 * ✅ Prezzo toelettatura dinamico:
 * base per taglia + moltiplicatore per difficoltà lavaggio.
 *
 * NOTE:
 * - Sono valori MVP, facilmente modificabili.
 * - Se vuoi li mettiamo in DB/config lato business più avanti.
 */
export const GROOMING_BASE_BY_SIZE: Record<DogSize, number> = {
  toy: 20,
  piccola: 25,
  media: 30,
  grande: 40,
  gigante: 50,
};

export const GROOMING_MULTIPLIER_BY_DIFFICULTY: Record<WashDifficulty, number> =
  {
    1: 1.0,  // facile
    2: 1.1,  // medio
    3: 1.2,  // difficile
  };
