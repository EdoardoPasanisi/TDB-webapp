// lib/services/pensione/utils.ts
import type { TaxiDistanceBand, TaxiOption } from '@/types/booking';
import type { BookingDogExtras } from '@/types/booking';
import type { DogLite, PerDogForm, PensionePricing } from './types';
import {
  ACCOMMODATION_PRICES,
  DEFAULT_TIMES,
  EXTRA_PRICES,
  GROOMING_BASE_BY_SIZE,
  GROOMING_MULTIPLIER_BY_DIFFICULTY,
  TAXI_PRICES_WITH_DISTANCE,
} from './constants';
import type { DogSize, WashDifficulty } from '@/data/dogBreeds';

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

function readHour(value: string): number | null {
  if (!value) return null;
  const [hStr] = value.split(':');
  const hour = parseInt(hStr ?? '', 10);
  return Number.isInteger(hour) ? hour : null;
}

function isMorningWindow(hour: number): boolean {
  return hour >= 9 && hour < 13;
}

function isAfternoonWindow(hour: number): boolean {
  return hour >= 15 && hour < 18;
}

export function validateTimeWindow(label: string, value: string, date?: string | null): string | null {
  if (!value) return null;
  const hour = readHour(value);
  if (hour === null) return `${label} non valido.`;

  const isSunday = isSundayDate(String(date ?? ''));
  const ok = isMorningWindow(hour) || (!isSunday && isAfternoonWindow(hour));
  if (!ok) {
    if (isSunday) return `${label} di domenica deve essere tra 9–13.`;
    return `${label} deve essere tra 9–13 o 15–18.`;
  }

  return null;
}

export function normalizeSundayTime(value: string, date?: string | null): string {
  const hour = readHour(value);
  if (hour === null) return value;
  if (!isSundayDate(String(date ?? ''))) return value;
  return isMorningWindow(hour) ? value : DEFAULT_TIMES.ARRIVAL;
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

  const [hStr] = departureTime.split(':');
  const hour = parseInt(hStr ?? '0', 10);

  // 9–13 → non si conta il giorno di partenza
  if (hour >= 9 && hour < 13) return Math.max(baseDays - 1, 1);

  // 15–18 → si conta il giorno di partenza
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
export function computeGroomingPriceForDog(dog: DogLite): number {
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

export function computePricing(args: {
  selectedDogIds: string[];
  daysCount: number;
  dogs: DogLite[];
  perDogForm: Record<string, PerDogForm>;
  taxiOption: TaxiOption;
  taxiDistanceBand: TaxiDistanceBand;
}): PensionePricing {
  const { selectedDogIds, daysCount, dogs, perDogForm, taxiOption, taxiDistanceBand } =
    args;

  if (selectedDogIds.length === 0 || daysCount <= 0) {
    return {
      dogsCount: selectedDogIds.length,
      discountPercent: 0,
      alloggioTotalFull: 0,
      alloggioTotalDiscounted: 0,
      extrasTotal: 0,
      taxiPrice: 0,
      totalPrice: 0,
    };
  }

  const dogsCount = selectedDogIds.length;

  let discountPercent = 0;
  if (dogsCount === 2) discountPercent = 15;
  if (dogsCount >= 3) discountPercent = 20;

  let alloggioTotalFull = 0;
  let extrasTotalPerDogs = 0;

  for (const dogId of selectedDogIds) {
    const form = perDogForm[dogId];
    if (!form) continue;

    const dog = dogs.find((d) => d.id === dogId);
    if (!dog) continue;

    const acc = ACCOMMODATION_PRICES[form.accommodationType];
    alloggioTotalFull += acc.pricePerDay * daysCount;

    const groomingPrice = form.grooming ? computeGroomingPriceForDog(dog) : 0;

    extrasTotalPerDogs +=
      groomingPrice +
      (form.vaccine ? EXTRA_PRICES.VACCINE : 0) +
      form.trackingSessions * EXTRA_PRICES.TRACKING +
      form.fitnessSessions * EXTRA_PRICES.FITNESS +
      form.walkSessions * EXTRA_PRICES.WALK +
      form.trekkingSessions * EXTRA_PRICES.TREKKING;
  }

  const taxiPrice = computeTaxiPrice(taxiOption, taxiDistanceBand);

  const alloggioTotalDiscounted =
    alloggioTotalFull * (dogsCount > 1 ? 1 - discountPercent / 100 : 1);

  const extrasTotal = extrasTotalPerDogs + taxiPrice;
  const totalPrice = alloggioTotalDiscounted + extrasTotal;

  return {
    dogsCount,
    discountPercent: dogsCount > 1 ? discountPercent : 0,
    alloggioTotalFull,
    alloggioTotalDiscounted,
    extrasTotal,
    taxiPrice,
    totalPrice,
  };
}

export function buildExtrasPayload(form: PerDogForm): BookingDogExtras {
  return {
    grooming: form.grooming,
    vaccine: form.vaccine,
    trackingSessions: form.trackingSessions,
    fitnessSessions: form.fitnessSessions,
    walkSessions: form.walkSessions,
    trekkingSessions: form.trekkingSessions,
    therapyActive: form.therapy === 'YES',
    therapyNotes: form.therapy === 'YES' ? form.therapyNotes : '',
  };
}

export function computePerDogTotals(args: {
  dog: DogLite;
  form: PerDogForm;
  daysCount: number;
}): {
  accommodation_price_per_day: number;
  accommodation_subtotal: number;
  extras_subtotal: number;
  per_dog_total: number;
  grooming_price: number;
} {
  const { dog, form, daysCount } = args;
  const acc = ACCOMMODATION_PRICES[form.accommodationType];

  const accommodation_subtotal = acc.pricePerDay * daysCount;

  const grooming_price = form.grooming ? computeGroomingPriceForDog(dog) : 0;

  const extras_subtotal =
    grooming_price +
    (form.vaccine ? EXTRA_PRICES.VACCINE : 0) +
    form.trackingSessions * EXTRA_PRICES.TRACKING +
    form.fitnessSessions * EXTRA_PRICES.FITNESS +
    form.walkSessions * EXTRA_PRICES.WALK +
    form.trekkingSessions * EXTRA_PRICES.TREKKING;

  return {
    accommodation_price_per_day: acc.pricePerDay,
    accommodation_subtotal,
    extras_subtotal,
    per_dog_total: accommodation_subtotal + extras_subtotal,
    grooming_price,
  };
}
