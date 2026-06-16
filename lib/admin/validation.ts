import { sanitizeFiscalCode } from '@/lib/validation/italy';
import type { AdminBookingKind, AdminDocumentStatus, AdminServiceKey, StaffRole } from '@/lib/admin/types';
import type { BookingStatus } from '@/types/booking';
import type { DogInput, DogSex, DogSize, WashDifficulty } from '@/types/dog';
import type { Profile } from '@/types/profile';
import type { ServiceStatus, ServiceType, ServiceVariant } from '@/types/services';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STAFF_ROLE_SET = new Set<StaffRole>(['ADMIN', 'VIEWER']);
const ADMIN_SERVICE_KEY_SET = new Set<AdminServiceKey>([
  'PENSIONE',
  'ASILO',
  'ADDESTRAMENTO',
  'CONSULENZA',
  'TOELETTATURA',
  'VACCINAZIONE',
  'TRACKING',
  'FITNESS',
  'PASSEGGIATA',
  'TREKKING',
  'TERAPIA',
  'TAXI_DOG',
]);
const SERVICE_TYPE_SET = new Set<ServiceType>(['PENSIONE', 'ASILO', 'ADDESTRAMENTO', 'CONSULENZA']);
const SERVICE_VARIANT_SET = new Set<ServiceVariant>(['SESSION_60', 'HALF', 'FULL']);
const ADMIN_STATUS_SET = new Set<BookingStatus | ServiceStatus>([
  'DRAFT',
  'PENDING',
  'CONFIRMED',
  'PAID',
  'CANCELLED',
  'COMPLETED',
]);
const DOG_SIZE_SET = new Set<DogSize>(['toy', 'piccola', 'media', 'grande', 'gigante']);
const DOG_SEX_SET = new Set<DogSex>(['male', 'female']);
const WASH_DIFFICULTY_SET = new Set<WashDifficulty>([1, 2, 3]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function toTrimmedString(value: unknown): string {
  return String(value ?? '').trim();
}

function sanitizeOptionalText(value: unknown, maxLength: number): string | null {
  const trimmed = toTrimmedString(value).replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeRequiredText(value: unknown, maxLength: number, label: string): string {
  const normalized = sanitizeOptionalText(value, maxLength);
  if (!normalized) {
    throw new Error(`${label} mancante.`);
  }
  return normalized;
}

function sanitizeBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} non valido.`);
  }
  return value;
}

function sanitizeDateOnly(value: unknown, label: string): string | null {
  const normalized = sanitizeOptionalText(value, 10);
  if (!normalized) return null;
  if (!DATE_RE.test(normalized)) throw new Error(`${label} non valida.`);

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${label} non valida.`);
  }

  return normalized;
}

function sanitizeIsoDateTime(value: unknown, label: string): string {
  const normalized = sanitizeRequiredText(value, 64, label);
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) throw new Error(`${label} non valida.`);
  return normalized;
}

function sanitizeStatus(value: unknown, label: string): BookingStatus | ServiceStatus {
  const normalized = toTrimmedString(value).toUpperCase() as BookingStatus | ServiceStatus;
  if (!ADMIN_STATUS_SET.has(normalized)) throw new Error(`${label} non valido.`);
  return normalized;
}

function sanitizeNullableEmail(value: unknown): string | null {
  const normalized = sanitizeOptionalText(value, 160)?.toLowerCase() ?? null;
  if (!normalized) return null;
  if (!EMAIL_RE.test(normalized)) throw new Error('Email non valida.');
  return normalized;
}

export function assertUuid(value: unknown, label: string): string {
  const normalized = toTrimmedString(value);
  if (!UUID_RE.test(normalized)) throw new Error(`${label} non valido.`);
  return normalized;
}

export function sanitizeSearchQuery(value: unknown, maxLength = 120): string {
  return toTrimmedString(value).replace(/\s+/g, ' ').slice(0, maxLength);
}

export function sanitizeDateRangeInput(startValue: unknown, endValue: unknown): { startDate: string; endDate: string } {
  const startDate = sanitizeDateOnly(startValue, 'Data iniziale');
  const endDate = sanitizeDateOnly(endValue, 'Data finale');

  if (!startDate || !endDate) {
    throw new Error('Intervallo date non valido.');
  }

  if (startDate > endDate) {
    throw new Error('La data finale deve essere uguale o successiva alla data iniziale.');
  }

  return { startDate, endDate };
}

export function sanitizeAdminStatusInput(value: unknown, allowAll = true): BookingStatus | ServiceStatus | 'ALL' {
  const normalized = toTrimmedString(value).toUpperCase();
  if (allowAll && (!normalized || normalized === 'ALL')) return 'ALL';
  return sanitizeStatus(normalized, 'Status');
}

export function sanitizeAdminServiceKeyInput(value: unknown): AdminServiceKey {
  const normalized = toTrimmedString(value).toUpperCase() as AdminServiceKey;
  if (!ADMIN_SERVICE_KEY_SET.has(normalized)) throw new Error('Servizio non valido.');
  return normalized;
}

export function sanitizeAdminServiceKeysInput(value: unknown): AdminServiceKey[] {
  const normalized = toTrimmedString(value).toUpperCase();
  if (!normalized || normalized === 'ALL') {
    return Array.from(ADMIN_SERVICE_KEY_SET);
  }

  const keys = Array.from(
    new Set(
      normalized
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => sanitizeAdminServiceKeyInput(entry))
    )
  );

  if (keys.length === 0) {
    throw new Error('Servizio non valido.');
  }

  return keys;
}

export function sanitizeServiceTypeOrAllInput(value: unknown): ServiceType | 'ALL' {
  const normalized = toTrimmedString(value).toUpperCase();
  if (!normalized || normalized === 'ALL') return 'ALL';
  if (!SERVICE_TYPE_SET.has(normalized as ServiceType)) throw new Error('Tipo servizio non valido.');
  return normalized as ServiceType;
}

export function sanitizeStaffMemberInput(body: unknown): {
  userId: string;
  role: StaffRole;
} {
  if (!isPlainObject(body)) throw new Error('Payload staff non valido.');

  const userId = assertUuid(body.userId, 'Utente staff');
  const role = toTrimmedString(body.role).toUpperCase() as StaffRole;

  if (!STAFF_ROLE_SET.has(role)) throw new Error('Ruolo staff non valido.');

  return { userId, role };
}

export function sanitizeStaffRoleUpdateInput(roleValue: unknown): StaffRole | null {
  if (roleValue === undefined) {
    throw new Error('Ruolo staff non valido.');
  }

  const normalized = toTrimmedString(roleValue).toUpperCase();
  if (!normalized) return null;
  if (!STAFF_ROLE_SET.has(normalized as StaffRole)) throw new Error('Ruolo staff non valido.');
  return normalized as StaffRole;
}

export function sanitizeDocumentDecisionInput(body: unknown): {
  status: Extract<AdminDocumentStatus, 'ACCEPTED' | 'REJECTED'>;
  staffNote: string | null;
} {
  if (!isPlainObject(body)) throw new Error('Payload documento non valido.');

  const status = toTrimmedString(body.status).toUpperCase() as Extract<AdminDocumentStatus, 'ACCEPTED' | 'REJECTED'>;
  if (status !== 'ACCEPTED' && status !== 'REJECTED') throw new Error('Status documento non valido.');

  return {
    status,
    staffNote: sanitizeOptionalText(body.staffNote, 500),
  };
}

export function sanitizeBookingStatusPatchInput(kindValue: unknown, statusValue: unknown): {
  kind: AdminBookingKind;
  status: BookingStatus | ServiceStatus;
} {
  const normalizedKind = toTrimmedString(kindValue).toLowerCase();
  if (normalizedKind !== 'pensione' && normalizedKind !== 'service-slot') {
    throw new Error('Tipo prenotazione non valido.');
  }

  const status = sanitizeStatus(statusValue, 'Status prenotazione');
  if (status !== 'CONFIRMED' && status !== 'PAID' && status !== 'CANCELLED') {
    throw new Error('Status prenotazione non valido.');
  }

  return {
    kind: normalizedKind === 'service-slot' ? 'SERVICE_SLOT' : 'PENSIONE',
    status,
  };
}

export function sanitizeSlotInput(body: unknown): {
  slotId: string | null;
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;
  startAt: string;
  endAt: string;
  capacity: number;
  notes: string | null;
} {
  if (!isPlainObject(body)) throw new Error('Payload slot non valido.');

  const slotId = body.slotId == null || toTrimmedString(body.slotId) === '' ? null : assertUuid(body.slotId, 'Slot');
  const serviceType = sanitizeServiceTypeOrAllInput(body.serviceType);
  if (serviceType === 'ALL') throw new Error('Tipo servizio slot non valido.');

  const variantRaw = toTrimmedString(body.serviceVariant).toUpperCase();
  const serviceVariant = !variantRaw ? null : (variantRaw as ServiceVariant);
  if (serviceVariant !== null && !SERVICE_VARIANT_SET.has(serviceVariant)) {
    throw new Error('Variante servizio non valida.');
  }

  const startAt = sanitizeIsoDateTime(body.startAt, 'Data inizio slot');
  const endAt = sanitizeIsoDateTime(body.endAt, 'Data fine slot');
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    throw new Error('La fine dello slot deve essere successiva all’inizio.');
  }

  const capacity = typeof body.capacity === 'number' ? body.capacity : Number.NaN;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
    throw new Error('Capienza slot non valida.');
  }

  return {
    slotId,
    serviceType,
    serviceVariant,
    startAt,
    endAt,
    capacity,
    notes: sanitizeOptionalText(body.notes, 1000),
  };
}

export function sanitizeSlotDeleteInput(body: unknown): { slotId: string } {
  if (!isPlainObject(body)) throw new Error('Payload eliminazione slot non valido.');
  return { slotId: assertUuid(body.slotId, 'Slot') };
}

export function sanitizeProfilePatch(body: unknown): Partial<Profile> {
  if (!isPlainObject(body)) throw new Error('Payload profilo non valido.');

  const payload: Partial<Profile> = {};

  if (hasOwn(body, 'first_name')) payload.first_name = sanitizeOptionalText(body.first_name, 80);
  if (hasOwn(body, 'last_name')) payload.last_name = sanitizeOptionalText(body.last_name, 80);
  if (hasOwn(body, 'phone')) payload.phone = sanitizeOptionalText(body.phone, 40);
  if (hasOwn(body, 'email')) payload.email = sanitizeNullableEmail(body.email);
  if (hasOwn(body, 'address_line')) payload.address_line = sanitizeOptionalText(body.address_line, 160);
  if (hasOwn(body, 'city')) payload.city = sanitizeOptionalText(body.city, 80);
  if (hasOwn(body, 'zip_code')) payload.zip_code = sanitizeOptionalText(body.zip_code, 16);
  if (hasOwn(body, 'province')) payload.province = sanitizeOptionalText(body.province, 16);
  if (hasOwn(body, 'fiscal_code')) {
    payload.fiscal_code = sanitizeOptionalText(sanitizeFiscalCode(toTrimmedString(body.fiscal_code)), 32);
  }
  if (hasOwn(body, 'birth_date')) payload.birth_date = sanitizeDateOnly(body.birth_date, 'Data di nascita');
  if (hasOwn(body, 'dog_address_line')) {
    payload.dog_address_line = sanitizeOptionalText(body.dog_address_line, 160);
  }
  if (hasOwn(body, 'dog_city')) payload.dog_city = sanitizeOptionalText(body.dog_city, 80);
  if (hasOwn(body, 'dog_zip_code')) payload.dog_zip_code = sanitizeOptionalText(body.dog_zip_code, 16);
  if (hasOwn(body, 'dog_province')) payload.dog_province = sanitizeOptionalText(body.dog_province, 16);

  const booleanFields: Array<keyof Pick<
    Profile,
    | 'show_first_name_on_dog_card'
    | 'show_last_name_on_dog_card'
    | 'show_phone_on_dog_card'
    | 'show_email_on_dog_card'
    | 'show_address_on_dog_card'
    | 'show_dog_address_on_dog_card'
  >> = [
    'show_first_name_on_dog_card',
    'show_last_name_on_dog_card',
    'show_phone_on_dog_card',
    'show_email_on_dog_card',
    'show_address_on_dog_card',
    'show_dog_address_on_dog_card',
  ];

  for (const field of booleanFields) {
    if (!hasOwn(body, field)) continue;
    payload[field] = sanitizeBoolean(body[field], field);
  }

  return payload;
}

export function sanitizeProfileCardPreferencesPatch(body: unknown): Pick<
  Profile,
  | 'show_first_name_on_dog_card'
  | 'show_last_name_on_dog_card'
  | 'show_phone_on_dog_card'
  | 'show_email_on_dog_card'
  | 'show_address_on_dog_card'
  | 'show_dog_address_on_dog_card'
> {
  if (!isPlainObject(body)) throw new Error('Payload preferenze profilo non valido.');

  return {
    show_first_name_on_dog_card: sanitizeBoolean(body.show_first_name_on_dog_card, 'Visibilità nome'),
    show_last_name_on_dog_card: sanitizeBoolean(body.show_last_name_on_dog_card, 'Visibilità cognome'),
    show_phone_on_dog_card: sanitizeBoolean(body.show_phone_on_dog_card, 'Visibilità telefono'),
    show_email_on_dog_card: sanitizeBoolean(body.show_email_on_dog_card, 'Visibilità email'),
    show_address_on_dog_card: sanitizeBoolean(body.show_address_on_dog_card, 'Visibilità indirizzo'),
    show_dog_address_on_dog_card: sanitizeBoolean(
      body.show_dog_address_on_dog_card,
      'Visibilità indirizzo cani'
    ),
  };
}

export function sanitizeDogInput(body: unknown): DogInput {
  if (!isPlainObject(body)) throw new Error('Payload cane non valido.');

  const name = sanitizeRequiredText(body.name, 80, 'Nome cane');
  const sizeCategory = sanitizeOptionalText(body.size_category, 16);
  const groomingDifficulty = body.grooming_difficulty == null || body.grooming_difficulty === ''
    ? null
    : Number(body.grooming_difficulty);
  const sex = sanitizeOptionalText(body.sex, 16);

  if (sizeCategory && !DOG_SIZE_SET.has(sizeCategory as DogSize)) {
    throw new Error('Taglia cane non valida.');
  }

  if (groomingDifficulty !== null && !WASH_DIFFICULTY_SET.has(groomingDifficulty as WashDifficulty)) {
    throw new Error('Difficoltà toilettatura non valida.');
  }

  if (sex && !DOG_SEX_SET.has(sex as DogSex)) {
    throw new Error('Sesso cane non valido.');
  }

  const temperament = body.temperament == null
    ? null
    : Array.isArray(body.temperament)
      ? Array.from(
          new Set(
            body.temperament
              .map((value) => sanitizeOptionalText(value, 40))
              .filter((value): value is string => Boolean(value))
          )
        ).slice(0, 12)
      : null;

  if (body.temperament != null && !Array.isArray(body.temperament)) {
    throw new Error('Temperamento cane non valido.');
  }

  const weightKg = (() => {
    const raw = body.weight_kg;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n < 500 ? Math.round(n * 10) / 10 : null;
  })();

  if (body.origin_breeds != null && !Array.isArray(body.origin_breeds)) {
    throw new Error('Razze d’origine non valide.');
  }
  const originBreeds = Array.isArray(body.origin_breeds)
    ? Array.from(
        new Set(
          body.origin_breeds
            .map((value) => sanitizeOptionalText(value, 80))
            .filter((value): value is string => Boolean(value))
        )
      ).slice(0, 8)
    : null;

  return {
    name,
    breed: sanitizeOptionalText(body.breed, 80),
    size_category: sizeCategory as DogSize | null,
    grooming_difficulty: groomingDifficulty as WashDifficulty | null,
    sex: (sex as DogSex | null) ?? null,
    microchip: sanitizeOptionalText(body.microchip, 64),
    birth_date: sanitizeDateOnly(body.birth_date, 'Data nascita cane'),
    notes: sanitizeOptionalText(body.notes, 1000),
    coat_color: sanitizeOptionalText(body.coat_color, 80),
    temperament,
    weight_kg: weightKg,
    origin_breeds: originBreeds && originBreeds.length > 0 ? originBreeds : null,
    show_weight: sanitizeBoolean(body.show_weight ?? false, 'Visibilità peso'),
    show_origin_breeds: sanitizeBoolean(body.show_origin_breeds ?? false, 'Visibilità razze d’origine'),
    show_breed: sanitizeBoolean(body.show_breed, 'Visibilità razza'),
    show_sex: sanitizeBoolean(body.show_sex, 'Visibilità sesso'),
    show_size: sanitizeBoolean(body.show_size, 'Visibilità taglia'),
    show_microchip: sanitizeBoolean(body.show_microchip, 'Visibilità microchip'),
    show_birth_date: sanitizeBoolean(body.show_birth_date, 'Visibilità data nascita'),
    show_notes: sanitizeBoolean(body.show_notes, 'Visibilità note'),
    show_coat_color: sanitizeBoolean(body.show_coat_color, 'Visibilità colore mantello'),
    show_temperament: sanitizeBoolean(body.show_temperament, 'Visibilità temperamento'),
  };
}

export function sanitizeDogCardVisibilityPatch(body: unknown): Pick<
  DogInput,
  | 'show_breed'
  | 'show_sex'
  | 'show_size'
  | 'show_microchip'
  | 'show_birth_date'
  | 'show_notes'
  | 'show_coat_color'
  | 'show_temperament'
  | 'show_weight'
  | 'show_origin_breeds'
> {
  if (!isPlainObject(body)) throw new Error('Payload preferenze cane non valido.');

  return {
    show_breed: sanitizeBoolean(body.show_breed, 'Visibilità razza'),
    show_sex: sanitizeBoolean(body.show_sex, 'Visibilità sesso'),
    show_size: sanitizeBoolean(body.show_size, 'Visibilità taglia'),
    show_microchip: sanitizeBoolean(body.show_microchip, 'Visibilità microchip'),
    show_birth_date: sanitizeBoolean(body.show_birth_date, 'Visibilità data nascita'),
    show_notes: sanitizeBoolean(body.show_notes, 'Visibilità note'),
    show_coat_color: sanitizeBoolean(body.show_coat_color, 'Visibilità colore mantello'),
    show_temperament: sanitizeBoolean(body.show_temperament, 'Visibilità temperamento'),
    show_weight: sanitizeBoolean(body.show_weight ?? false, 'Visibilità peso'),
    show_origin_breeds: sanitizeBoolean(body.show_origin_breeds ?? false, 'Visibilità razze d’origine'),
  };
}
