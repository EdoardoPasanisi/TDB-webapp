// Voci di costo di una prenotazione pensione: usato sia nel dettaglio gestionale sia nella
// stampa per mostrare di quali costi si compone il prezzo finale.
import type { AccommodationKey, BookingDogExtras } from '@/types/booking';
import type { DogSize, WashDifficulty } from '@/data/dogBreeds';
import { ACCOMMODATION_PRICES, EXTRA_PRICES } from './constants';
import { computeGroomingPriceForDog } from './utils';
import type { DogLite } from './types';

export interface PensioneCostLine {
  label: string;
  amount: number;
}

function accommodationLabel(type: AccommodationKey | string | null): string {
  if (!type) return 'Alloggio';
  const known = ACCOMMODATION_PRICES[type as AccommodationKey];
  return known?.label ?? 'Alloggio';
}

/**
 * Righe di costo per un singolo cane della prenotazione (alloggio + extra). Il taxi è a
 * livello di prenotazione e va aggiunto a parte con buildBookingLevelCostLines().
 */
export function buildDogCostLines(args: {
  accommodationType: AccommodationKey | string | null;
  accommodationPricePerDay: number | null;
  accommodationSubtotal: number | null;
  daysCount: number | null;
  extras: BookingDogExtras | null;
  sizeCategory: DogSize | null;
  groomingDifficulty: WashDifficulty | null;
}): PensioneCostLine[] {
  const { accommodationType, accommodationPricePerDay, accommodationSubtotal, daysCount, extras } = args;
  const lines: PensioneCostLine[] = [];

  const perDay = accommodationPricePerDay ?? 0;
  const days = daysCount ?? 0;
  const subtotal = accommodationSubtotal ?? perDay * days;
  const perDayLabel = perDay > 0 && days > 0 ? ` (${perDay}€/g × ${days} gg)` : '';
  lines.push({ label: `${accommodationLabel(accommodationType)}${perDayLabel}`, amount: subtotal });

  if (!extras) return lines;

  if (extras.grooming) {
    const grooming = computeGroomingPriceForDog({
      size_category: args.sizeCategory,
      grooming_difficulty: args.groomingDifficulty,
    } as DogLite);
    lines.push({ label: 'Toelettatura', amount: grooming });
  }
  if (extras.vaccine) {
    lines.push({ label: 'Vaccinazione', amount: EXTRA_PRICES.VACCINE });
  }
  if ((extras.trackingSessions ?? 0) > 0) {
    lines.push({ label: `Ricerca olfattiva ×${extras.trackingSessions}`, amount: (extras.trackingSessions ?? 0) * EXTRA_PRICES.TRACKING });
  }
  if ((extras.fitnessSessions ?? 0) > 0) {
    lines.push({ label: `Fitness ×${extras.fitnessSessions}`, amount: (extras.fitnessSessions ?? 0) * EXTRA_PRICES.FITNESS });
  }
  if ((extras.walkSessions ?? 0) > 0) {
    lines.push({ label: `Passeggiate ×${extras.walkSessions}`, amount: (extras.walkSessions ?? 0) * EXTRA_PRICES.WALK });
  }
  if ((extras.trekkingSessions ?? 0) > 0) {
    lines.push({ label: `Trekking ×${extras.trekkingSessions}`, amount: (extras.trekkingSessions ?? 0) * EXTRA_PRICES.TREKKING });
  }

  return lines;
}
