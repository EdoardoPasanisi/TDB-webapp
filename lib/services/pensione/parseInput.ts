// Parser/validator condiviso del payload prenotazione pensione.
// Usato sia dalla rotta utente (app/api/pensione-bookings) sia dall'edit
// completo lato gestionale (app/api/admin/bookings/pensione/[bookingId]).
import type { SavePensioneBookingInput } from '@/lib/services/pensione/api';
import type { PerDogForm } from '@/lib/services/pensione/types';
import type { AccommodationKey, TaxiDistanceBand, TaxiOption } from '@/types/booking';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TAXI_OPTIONS = new Set<TaxiOption>(['NONE', 'ONE_WAY', 'RETURN_ONLY', 'ROUND_TRIP']);
const TAXI_DISTANCE_BANDS = new Set<TaxiDistanceBand>(['ENTRO_40', 'OLTRE_40']);
const ACCOMMODATION_KEYS = new Set<AccommodationKey>([
  'BOX',
  'BOX_GARDEN',
  'CHALET',
  'APT_GARDEN',
  'APT_GARDEN_NIGHT_PERSON',
  'HOTEL',
  'CATTERY',
]);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeUuid(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeDate(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeTime(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeTherapy(value: unknown): PerDogForm['therapy'] | null {
  if (value === 'YES' || value === 'NO' || value === '') return value;
  return null;
}

function parsePerDogForm(value: unknown): PerDogForm | null {
  if (!isPlainObject(value)) return null;

  const accommodationType = String(value.accommodationType ?? '').trim() as AccommodationKey;
  const grooming = normalizeBoolean(value.grooming);
  const vaccine = normalizeBoolean(value.vaccine);
  const trackingSessions = normalizeNonNegativeInteger(value.trackingSessions);
  const fitnessSessions = normalizeNonNegativeInteger(value.fitnessSessions);
  const walkSessions = normalizeNonNegativeInteger(value.walkSessions);
  // Retrocompatibilità: prenotazioni salvate prima del trekking possono non avere il campo.
  const trekkingSessions =
    value.trekkingSessions === undefined ? 0 : normalizeNonNegativeInteger(value.trekkingSessions);
  const therapy = normalizeTherapy(value.therapy);
  const therapyNotes = String(value.therapyNotes ?? '');

  if (!ACCOMMODATION_KEYS.has(accommodationType)) return null;
  if (grooming === null || vaccine === null) return null;
  if (trackingSessions === null || fitnessSessions === null || walkSessions === null) return null;
  if (trekkingSessions === null) return null;
  if (therapy === null || therapy === '') return null;
  if (therapy === 'YES' && !therapyNotes.trim()) return null;

  return {
    accommodationType,
    grooming,
    vaccine,
    trackingSessions,
    fitnessSessions,
    walkSessions,
    trekkingSessions,
    therapy,
    therapyNotes,
  };
}

export function parsePensioneBookingInput(body: unknown): SavePensioneBookingInput | null {
  if (!isPlainObject(body)) return null;

  const bookingIdRaw = body.bookingId;
  const bookingId = bookingIdRaw == null || String(bookingIdRaw).trim() === '' ? null : normalizeUuid(bookingIdRaw);
  if (bookingIdRaw != null && String(bookingIdRaw).trim() !== '' && !bookingId) return null;

  const startDate = normalizeDate(body.startDate);
  const endDate = normalizeDate(body.endDate);
  const arrivalTime = normalizeTime(body.arrivalTime);
  const departureTime = normalizeTime(body.departureTime);
  const taxiOption = String(body.taxiOption ?? '').trim() as TaxiOption;
  const taxiDistanceBand = String(body.taxiDistanceBand ?? '').trim() as TaxiDistanceBand;
  const notes = String(body.notes ?? '').trim();

  if (!startDate || !endDate || !arrivalTime || !departureTime) return null;
  if (!TAXI_OPTIONS.has(taxiOption) || !TAXI_DISTANCE_BANDS.has(taxiDistanceBand)) return null;
  if (!Array.isArray(body.selectedDogIds) || !isPlainObject(body.perDogForm)) return null;

  const selectedDogIds = Array.from(
    new Set(body.selectedDogIds.map((value) => normalizeUuid(value)).filter((value): value is string => Boolean(value)))
  );

  if (selectedDogIds.length === 0) return null;

  const perDogFormEntries: Array<[string, PerDogForm]> = [];
  const perDogForm = body.perDogForm as Record<string, unknown>;

  for (const dogId of selectedDogIds) {
    const form = parsePerDogForm(perDogForm[dogId]);
    if (!form) return null;
    perDogFormEntries.push([dogId, form]);
  }

  return {
    bookingId,
    startDate,
    endDate,
    arrivalTime,
    departureTime,
    notes,
    taxiOption,
    taxiDistanceBand,
    selectedDogIds,
    perDogForm: Object.fromEntries(perDogFormEntries),
  };
}
