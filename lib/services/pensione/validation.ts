// lib/services/pensione/validation.ts

import type { AccommodationKey, BookingDogExtras, TaxiDistanceBand, TaxiOption } from '@/types/booking';

export type DateISO = `${number}-${number}-${number}`; // "YYYY-MM-DD"

export type DogSelection = {
  dogId: string;
  accommodationType: AccommodationKey;
  extras: BookingDogExtras;
};

export type PensioneFormInput = {
  startDate: DateISO | '';
  endDate: DateISO | '' | null;

  dogs: DogSelection[];

  taxiOption: TaxiOption;
  taxiDistanceBand: TaxiDistanceBand | null;

  // opzionale: in futuro aggiungeremo campi come pickup_time, return_time, notes
};

export type ValidationError = {
  field:
    | 'startDate'
    | 'endDate'
    | 'dogs'
    | 'dogs.accommodation'
    | 'taxiDistanceBand'
    | 'generic';
  message: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[]; firstMessage: string };

function isISODate(v: string): v is DateISO {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toDate(v: DateISO): Date {
  return new Date(`${v}T00:00:00`);
}

/**
 * Validazione “user friendly”:
 * - startDate obbligatoria
 * - se endDate presente deve essere >= startDate
 * - almeno 1 cane
 * - per ogni cane: deve avere accommodationType valido
 * - taxi: se taxiOption != NONE => taxiDistanceBand obbligatoria
 */
export function validatePensioneForm(input: PensioneFormInput): ValidationResult {
  const errors: ValidationError[] = [];

  // startDate
  if (!input.startDate || !isISODate(input.startDate)) {
    errors.push({ field: 'startDate', message: 'Seleziona la data di inizio.' });
  }

  // endDate (opzionale, ma se presente deve essere valida e >= start)
  const hasStart = !!input.startDate && isISODate(input.startDate);
  const endProvided = input.endDate !== null && input.endDate !== '';

  if (endProvided) {
    if (!isISODate(input.endDate as string)) {
      errors.push({ field: 'endDate', message: 'La data di fine non è valida.' });
    } else if (hasStart) {
      const start = toDate(input.startDate as DateISO);
      const end = toDate(input.endDate as DateISO);
      if (end.getTime() < start.getTime()) {
        errors.push({ field: 'endDate', message: 'La data di fine deve essere uguale o successiva alla data di inizio.' });
      }
    }
  }

  // dogs
  if (!input.dogs || input.dogs.length === 0) {
    errors.push({ field: 'dogs', message: 'Seleziona almeno un cane.' });
  } else {
    const missingAccommodation = input.dogs.some((d) => !d.accommodationType);
    if (missingAccommodation) {
      errors.push({
        field: 'dogs.accommodation',
        message: 'Seleziona un alloggio per ogni cane.',
      });
    }
  }

  // taxi
  if (input.taxiOption !== 'NONE') {
    if (!input.taxiDistanceBand) {
      errors.push({
        field: 'taxiDistanceBand',
        message: 'Seleziona la fascia km per il taxi dog.',
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, firstMessage: errors[0].message };
  }

  return { ok: true };
}

/**
 * Utility: normalizza input vuoti in valori puliti prima di salvarli nel DB.
 * - '' => null dove serve
 */
export function normalizePensioneForm(input: PensioneFormInput) {
  return {
    ...input,
    endDate: input.endDate === '' ? null : input.endDate,
  };
}
