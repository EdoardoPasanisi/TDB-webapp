// lib/services/pensione/constants.ts
import type { AccommodationKey, TaxiDistanceBand } from '@/types/booking';
import type { DogSize, WashDifficulty } from '@/data/dogBreeds';

export const DEFAULT_TIMES = {
  ARRIVAL: '10:00',
  DEPARTURE: '10:00',
} as const;

export const DEFAULT_TAXI = {
  option: 'NONE' as const,
  distanceBand: 'ENTRO_40' as const,
};

// Prezzi alloggi (€/giorno)
export const ACCOMMODATION_PRICES: Record<
  AccommodationKey,
  { label: string; pricePerDay: number }
> = {
  BOX: { label: 'Box', pricePerDay: 28 },
  BOX_GARDEN: { label: 'Box con giardino', pricePerDay: 35 },
  CHALET: { label: 'Chalet', pricePerDay: 35 },
  APT_GARDEN: { label: 'Appartamento con giardino', pricePerDay: 45 },
  APT_GARDEN_NIGHT_PERSON: {
    label: 'Appartamento con giardino (presenza notturna)',
    pricePerDay: 100,
  },
  CATTERY: { label: 'Gattile', pricePerDay: 25 },
};

// Prezzi taxi in base alla distanza
export const TAXI_PRICES_WITH_DISTANCE: Record<
  TaxiDistanceBand,
  { ONE_WAY: number; RETURN_ONLY: number; ROUND_TRIP: number }
> = {
  ENTRO_40: { ONE_WAY: 40, RETURN_ONLY: 40, ROUND_TRIP: 60 },
  OLTRE_40: { ONE_WAY: 50, RETURN_ONLY: 50, ROUND_TRIP: 70 },
};

// Prezzi extra “semplici”
export const EXTRA_PRICES = {
  VACCINE: 70,
  TRACKING: 30,
  FITNESS: 25,
  WALK: 15,
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
