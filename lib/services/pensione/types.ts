// lib/services/pensione/types.ts
import type { AccommodationKey } from '@/types/booking';
import type { DogSize, WashDifficulty } from '@/data/dogBreeds';

export interface DogLite {
  id: string;
  name: string;
  photo_path: string | null;
  updated_at: string | null;
  // ✅ ci servono per prezzo toelettatura
  size_category: DogSize | null;
  grooming_difficulty: WashDifficulty | null;
}

export type TherapyAnswer = 'YES' | 'NO' | '';

export interface PerDogForm {
  accommodationType: AccommodationKey;
  grooming: boolean;
  vaccine: boolean;
  trackingSessions: number;
  fitnessSessions: number;
  walkSessions: number;

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
