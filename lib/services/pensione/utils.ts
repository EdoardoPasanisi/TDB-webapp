// lib/services/pensione/utils.ts
import type { TaxiDistanceBand, TaxiOption } from '@/types/booking';
import type { BookingDogExtras } from '@/types/booking';
import type { DogLite, PerDogForm, PensionePricing } from './types';
import {
  DEFAULT_TIMES,
  EXTRA_PRICES,
  GROOMING_BASE_BY_SIZE,
  GROOMING_MULTIPLIER_BY_DIFFICULTY,
  TAXI_PRICES_WITH_DISTANCE,
} from './constants';
import type { DogSize, WashDifficulty } from '@/data/dogBreeds';
import {
  accommodationClimatePricePerDay,
  accommodationPricePerDay,
  findAccommodation,
  type AccommodationCatalog,
} from './accommodations';

export function getTodayISO(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function isSundayDate(value: string): boolean {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date.getDay() === 0;
}

// Fasce orarie di ingresso/uscita (estremi inclusi):
// mattina 9:00–13:00, pomeriggio 15:00–17:00 (la domenica solo mattina).
const MORNING_START = 9 * 60;
const MORNING_END = 13 * 60;
const AFTERNOON_START = 15 * 60;
const AFTERNOON_END = 17 * 60;

/** "HH:MM" (o "HH:MM:SS") → minuti dalla mezzanotte. */
function readMinutes(value: string): number | null {
  if (!value) return null;
  const [hStr, mStr] = value.split(':');
  const hour = parseInt(hStr ?? '', 10);
  const minute = mStr === undefined || mStr === '' ? 0 : parseInt(mStr, 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isMorningWindow(minutes: number): boolean {
  return minutes >= MORNING_START && minutes <= MORNING_END;
}

function isAfternoonWindow(minutes: number): boolean {
  return minutes >= AFTERNOON_START && minutes <= AFTERNOON_END;
}

export function validateTimeWindow(label: string, value: string, date?: string | null): string | null {
  if (!value) return null;
  const minutes = readMinutes(value);
  if (minutes === null) return `${label} non valido.`;

  const isSunday = isSundayDate(String(date ?? ''));
  const ok = isMorningWindow(minutes) || (!isSunday && isAfternoonWindow(minutes));
  if (!ok) {
    if (isSunday) return `${label} di domenica deve essere tra 9:00 e 13:00.`;
    return `${label} deve essere tra 9:00–13:00 o 15:00–17:00.`;
  }

  return null;
}

export function normalizeSundayTime(value: string, date?: string | null): string {
  const minutes = readMinutes(value);
  if (minutes === null) return value;
  if (!isSundayDate(String(date ?? ''))) return value;
  return isMorningWindow(minutes) ? value : DEFAULT_TIMES.ARRIVAL;
}

/** Uscita entro le 13:00 (comprese) → il giorno di partenza non si conta. */
export function isMorningDeparture(departureTime: string): boolean {
  const minutes = readMinutes(departureTime);
  return minutes !== null && minutes <= MORNING_END;
}

export function computeDaysCount(
  startDate: string,
  endDate: string,
  departureTime: string
): number {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const baseDays = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;

  if (baseDays <= 0) return 0;
  if (!departureTime) return baseDays;

  // Uscita entro le 13:00 comprese → non si conta il giorno di partenza
  if (isMorningDeparture(departureTime)) return Math.max(baseDays - 1, 1);

  // Pomeriggio → si conta il giorno di partenza
  return baseDays;
}

export function computeTaxiPrice(
  taxiOption: TaxiOption,
  taxiDistanceBand: TaxiDistanceBand
): number {
  const band = TAXI_PRICES_WITH_DISTANCE[taxiDistanceBand];
  if (taxiOption === 'ONE_WAY') return band.ONE_WAY;
  if (taxiOption === 'RETURN_ONLY') return band.RETURN_ONLY;
  if (taxiOption === 'ROUND_TRIP') return band.ROUND_TRIP;
  return 0;
}

/**
 * ✅ Prezzo toelettatura per cane.
 * Se mancano dati nel DB, usiamo fallback “media + difficoltà 2” (MVP robusto).
 */
export function computeGroomingPriceForDog(
  dog: Pick<DogLite, 'size_category' | 'grooming_difficulty'>
): number {
  const size: DogSize = dog.size_category ?? 'media';
  const diff: WashDifficulty = dog.grooming_difficulty ?? 2;

  const base = GROOMING_BASE_BY_SIZE[size] ?? GROOMING_BASE_BY_SIZE.media;
  const mult =
    GROOMING_MULTIPLIER_BY_DIFFICULTY[diff] ??
    GROOMING_MULTIPLIER_BY_DIFFICULTY[2];

  // arrotondiamo a 5€ per un prezzo “pulito”
  const raw = base * mult;
  const rounded = Math.round(raw / 5) * 5;

  return Math.max(0, rounded);
}

/**
 * Tariffe già storicizzate su una prenotazione salvata. Se presenti prevalgono sul
 * catalogo: servono quando si ricalcola una prenotazione per un motivo che non c'entra
 * con l'alloggio (es. cambia la taglia → cambia la toelettatura), così un cambio
 * prezzi nel gestionale non altera di nascosto le prenotazioni esistenti.
 */
export interface StoredDogRates {
  accommodationPricePerDay: number | null;
  /** Climatizzazione salvata sulla prenotazione (0 = non applicata). */
  climatePricePerDay: number;
}

function computeDogCosts(args: {
  catalog: AccommodationCatalog;
  dog: Pick<DogLite, 'size_category' | 'grooming_difficulty'>;
  form: PerDogForm;
  daysCount: number;
  totalDogs: number;
  stored?: StoredDogRates;
}) {
  const { catalog, dog, form, daysCount, totalDogs, stored } = args;

  const accommodation_price_per_day =
    stored?.accommodationPricePerDay ?? accommodationPricePerDay(catalog, form.accommodationType, totalDogs);
  const accommodation_subtotal = accommodation_price_per_day * daysCount;

  // Climatizzazione: la decide il gestionale per alloggio, non il cliente.
  const climatePricePerDay = stored
    ? stored.climatePricePerDay
    : accommodationClimatePricePerDay(catalog, form.accommodationType);
  const climate_subtotal = climatePricePerDay * daysCount;

  const grooming_price = form.grooming ? computeGroomingPriceForDog(dog) : 0;

  const extras_subtotal =
    climate_subtotal +
    grooming_price +
    (form.vaccine ? EXTRA_PRICES.VACCINE : 0) +
    form.trackingSessions * EXTRA_PRICES.TRACKING +
    form.fitnessSessions * EXTRA_PRICES.FITNESS +
    form.walkSessions * EXTRA_PRICES.WALK +
    form.trekkingSessions * EXTRA_PRICES.TREKKING;

  return {
    accommodation_price_per_day,
    accommodation_subtotal,
    climate_price_per_day: climatePricePerDay,
    climate_subtotal,
    extras_subtotal,
    per_dog_total: accommodation_subtotal + extras_subtotal,
    grooming_price,
  };
}

export function computePricing(args: {
  catalog: AccommodationCatalog;
  selectedDogIds: string[];
  daysCount: number;
  dogs: DogLite[];
  perDogForm: Record<string, PerDogForm>;
  taxiOption: TaxiOption;
  taxiDistanceBand: TaxiDistanceBand;
}): PensionePricing {
  const { catalog, selectedDogIds, daysCount, dogs, perDogForm, taxiOption, taxiDistanceBand } = args;

  if (selectedDogIds.length === 0 || daysCount <= 0) {
    return {
      dogsCount: selectedDogIds.length,
      discountPercent: 0,
      alloggioTotalFull: 0,
      alloggioTotalDiscounted: 0,
      extrasTotal: 0,
      climateTotal: 0,
      taxiPrice: 0,
      totalPrice: 0,
    };
  }

  const dogsCount = selectedDogIds.length;

  // Lo sconto multi-cane è incorporato nelle tariffe a scaglioni (tier) per numero di
  // cani: niente sconto percentuale separato.
  const discountPercent = 0;

  let alloggioTotalFull = 0;
  let extrasTotalPerDogs = 0;
  let climateTotal = 0;

  for (const dogId of selectedDogIds) {
    const form = perDogForm[dogId];
    if (!form) continue;

    const dog = dogs.find((d) => d.id === dogId);
    if (!dog) continue;

    const costs = computeDogCosts({ catalog, dog, form, daysCount, totalDogs: dogsCount });
    alloggioTotalFull += costs.accommodation_subtotal;
    extrasTotalPerDogs += costs.extras_subtotal;
    climateTotal += costs.climate_subtotal;
  }

  const taxiPrice = computeTaxiPrice(taxiOption, taxiDistanceBand);

  const alloggioTotalDiscounted = alloggioTotalFull;
  const extrasTotal = extrasTotalPerDogs + taxiPrice;
  const totalPrice = alloggioTotalDiscounted + extrasTotal;

  return {
    dogsCount,
    discountPercent,
    alloggioTotalFull,
    alloggioTotalDiscounted,
    extrasTotal,
    climateTotal,
    taxiPrice,
    totalPrice,
  };
}

/**
 * Extra da salvare su booking_dogs. Storicizza anche nome alloggio e prezzo della
 * climatizzazione, così la prenotazione resta leggibile e stabile se il catalogo cambia.
 */
export function buildExtrasPayload(form: PerDogForm, catalog: AccommodationCatalog): BookingDogExtras {
  const accommodation = findAccommodation(catalog, form.accommodationType);
  const climatePricePerDay = accommodationClimatePricePerDay(catalog, form.accommodationType);

  return {
    grooming: form.grooming,
    vaccine: form.vaccine,
    trackingSessions: form.trackingSessions,
    fitnessSessions: form.fitnessSessions,
    walkSessions: form.walkSessions,
    trekkingSessions: form.trekkingSessions,
    therapyActive: form.therapy === 'YES',
    therapyNotes: form.therapy === 'YES' ? form.therapyNotes : '',
    climate: climatePricePerDay > 0,
    ...(climatePricePerDay > 0 ? { climatePricePerDay } : {}),
    ...(accommodation ? { accommodationLabel: accommodation.label } : {}),
  };
}

export function computePerDogTotals(args: {
  catalog: AccommodationCatalog;
  dog: DogLite;
  form: PerDogForm;
  daysCount: number;
  totalDogs: number;
  stored?: StoredDogRates;
}): {
  accommodation_price_per_day: number;
  accommodation_subtotal: number;
  climate_price_per_day: number;
  climate_subtotal: number;
  extras_subtotal: number;
  per_dog_total: number;
  grooming_price: number;
} {
  return computeDogCosts(args);
}
