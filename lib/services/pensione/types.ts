// lib/services/pensione/types.ts
import type { AccommodationKey } from '@/types/booking';
import type { DogSize, WashDifficulty } from '@/data/dogBreeds';
import type { PetSpecies } from '@/types/dog';

export interface DogLite {
  id: string;
  name: string;
  photo_path: string | null;
  updated_at: string | null;
  // ✅ ci servono per prezzo toelettatura
  size_category: DogSize | null;
  grooming_difficulty: WashDifficulty | null;
  // Specie + requisiti prenotazione (facoltativi: usati solo nel flusso pensione utente)
  species?: PetSpecies | null;
  microchip?: string | null;
  birth_date?: string | null;
  libretto_name?: string | null;
}

export type TherapyAnswer = 'YES' | 'NO' | '';

export interface PerDogForm {
  accommodationType: AccommodationKey;
  grooming: boolean;
  vaccine: boolean;
  trackingSessions: number; // Ricerca olfattiva
  fitnessSessions: number;
  walkSessions: number;
  trekkingSessions: number; // Trekking in campagna

  therapy: TherapyAnswer;
  therapyNotes: string;
}

export interface PensionePricing {
  dogsCount: number;
  discountPercent: number;

  alloggioTotalFull: number;
  alloggioTotalDiscounted: number;

  extrasTotal: number; // include taxi
  taxiPrice: number;

  totalPrice: number;
}
