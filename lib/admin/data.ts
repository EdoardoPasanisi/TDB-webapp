import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  AdminAnalytics,
  AdminAgendaItem,
  AdminBookingDetail,
  AdminBookingKind,
  AdminDateViewResponse,
  AdminDocumentRecord,
  AdminDogDetail,
  AdminDogListItem,
  AdminOverview,
  AdminServiceKey,
  AdminServicesViewResponse,
  AdminSlotRecord,
  AdminStaffMember,
  AdminUserDetail,
  AdminUserListItem,
  StaffRole,
} from '@/lib/admin/types';
import { buildRequiredOwnerMissing } from '@/lib/admin/requirements';
import {
  ADMIN_SERVICE_OPTIONS,
  buildIlikePattern,
  bookingMatchesServiceKey,
  fileNameFromPath,
  formatPersonName,
  getAdminServiceLabel,
  isActiveBookingStatus,
  sanitizeSearchTerm,
} from '@/lib/admin/utils';
import type {
  BookingDogExtras,
  BookingDogRow,
  BookingRow,
  BookingStatus,
  TaxiOption,
} from '@/types/booking';
import type { Dog, DogInput } from '@/types/dog';
import type { Profile } from '@/types/profile';
import type {
  ServicePassRow,
  ServiceStatus,
  ServiceType,
  ServiceVariant,
} from '@/types/services';

const PROFILE_SELECT =
  'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, wallet_due_eur, deleted_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';
const DOG_SELECT =
  'id, owner_id, created_at, updated_at, species, species_other, libretto_name, name, breed, size_category, grooming_difficulty, sex, microchip, birth_date, notes, coat_color, temperament, photo_path, is_active, public_id, show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes, show_coat_color, show_temperament, weight_kg, origin_breeds, show_weight, show_origin_breeds';
const IDENTITY_BUCKET = 'identity-documents';
type AdminVisibilityMode = 'full' | 'limited';

type ProfileSummaryRow = Pick<
  Profile,
  'user_id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'city'
>;

type DogSummaryRow = Pick<
  Dog,
  'id' | 'owner_id' | 'name' | 'breed' | 'microchip' | 'size_category' | 'is_active'
>;

type UserDocumentRow = {
  id: string;
  user_id: string;
  kind: 'ID_DOCUMENT' | 'WAIVER_SIGNED';
  path: string;
  created_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  accepted_at: string | null;
  rejected_at: string | null;
  staff_note: string | null;
};

type DogJoin =
  | { id: string; name: string | null; breed: string | null; grooming_difficulty?: Dog['grooming_difficulty'] | null }
  | Array<{ id: string; name: string | null; breed: string | null; grooming_difficulty?: Dog['grooming_difficulty'] | null }>
  | null;

type BookingDogQueryRow = {
  id: string;
  booking_id: string;
  dog_id: string;
  extras: BookingDogExtras | null;
  accommodation_type?: BookingDogRow['accommodation_type'] | null;
  accommodation_price_per_day?: number | null;
  days_count?: number | null;
  accommodation_subtotal?: number | null;
  extras_subtotal?: number | null;
  per_dog_total?: number | null;
  dogs?: DogJoin;
};

type PensioneBookingQueryRow = Pick<
  BookingRow,
  | 'id'
  | 'user_id'
  | 'service_type'
  | 'start_date'
  | 'end_date'
  | 'arrival_time'
  | 'departure_time'
  | 'status'
  | 'notes'
  | 'total_price'
  | 'taxi_option'
  | 'taxi_distance_band'
  | 'taxi_price'
  | 'taxi_pickup_time'
  | 'taxi_return_time'
  | 'created_at'
> & {
  booking_dogs?: BookingDogQueryRow[] | null;
};

type ServiceSlotRelation = {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
} | Array<{
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
}> | null;

type ServiceSlotBookingQueryRow = {
  id: string;
  user_id: string;
  service_type: ServiceType | null;
  service_variant: ServiceVariant | null;
  slot_id: string;
  dog_id: string | null;
  dog_ids: string[] | null;
  taxi_enabled: boolean;
  taxi_distance_km: number | null;
  taxi_price_eur: number | null;
  total_price: number | null;
  pass_id: string | null;
  credits_spent: number | null;
  status: ServiceStatus;
  notes: string | null;
  created_at: string;
  service_slots?: ServiceSlotRelation;
};

type ServiceSlotRow = {
  id: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
  start_at: string;
  end_at: string;
  capacity: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

type StaffAccountRow = {
  user_id: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const ANALYTICS_SERVICE_KEYS = ['PENSIONE', 'ASILO', 'ADDESTRAMENTO', 'CONSULENZA'] as const;
type AnalyticsServiceKey = typeof ANALYTICS_SERVICE_KEYS[number];

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeSearchTokens(value: string): string[] {
  return sanitizeSearchTerm(value)
    .toLowerCase()
    .split(' ')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildTokenSearchOr(fields: string[], tokens: string[]): string {
  return tokens
    .flatMap((token) => {
      const pattern = buildIlikePattern(token);
      return fields.map((field) => `${field}.ilike.${pattern}`);
    })
    .join(',');
}

function buildProfileSearchHaystack(profile: Profile | ProfileSummaryRow | null | undefined, dogs: DogSummaryRow[] = []): string {
  const firstName = String(profile?.first_name ?? '').trim();
  const lastName = String(profile?.last_name ?? '').trim();

  return [
    firstName,
    lastName,
    `${firstName} ${lastName}`.trim(),
    `${lastName} ${firstName}`.trim(),
    profile?.email ?? '',
    profile?.phone ?? '',
    profile?.city ?? '',
    dogs.map((dog) => dog.name).join(' '),
    dogs.map((dog) => dog.breed ?? '').join(' '),
    dogs.map((dog) => dog.microchip ?? '').join(' '),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDogSearchHaystack(dog: DogSummaryRow, owner: Profile | ProfileSummaryRow | null | undefined): string {
  const firstName = String(owner?.first_name ?? '').trim();
  const lastName = String(owner?.last_name ?? '').trim();

  return [
    dog.name,
    dog.breed ?? '',
    dog.microchip ?? '',
    firstName,
    lastName,
    `${firstName} ${lastName}`.trim(),
    `${lastName} ${firstName}`.trim(),
    owner?.email ?? '',
    owner?.phone ?? '',
    owner?.city ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesSearch(haystack: string, search: string, tokens: string[]): boolean {
  if (!search) return true;
  if (haystack.includes(search)) return true;
  return tokens.every((token) => haystack.includes(token));
}

function slotBookingDogIds(row: Pick<ServiceSlotBookingQueryRow, 'dog_id' | 'dog_ids'>): string[] {
  return unique(
    [...(row.dog_ids ?? []), row.dog_id ?? '']
      .map((dogId) => String(dogId ?? '').trim())
      .filter(Boolean)
  );
}

function completionCutoffEndOfDay(value: string | null | undefined): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T23:59:59.999Z`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T23:59:59.999Z`;
}

function deriveAgendaStatus(
  status: BookingStatus | ServiceStatus | null | undefined,
  completionCutoff: string | null | undefined
): BookingStatus | ServiceStatus | null {
  if ((status === 'CONFIRMED' || status === 'PAID') && completionCutoff) {
    const cutoff = Date.parse(completionCutoff);
    if (!Number.isNaN(cutoff) && Date.now() > cutoff) {
      return 'COMPLETED';
    }
  }

  return status ?? null;
}

function formatDogCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'cane' : 'cani'}`;
}

function sanitizeProfileForViewer(profile: Profile | null): Profile | null {
  if (!profile) return null;

  return {
    ...profile,
    phone: null,
    email: null,
    address_line: null,
    city: null,
    zip_code: null,
    province: null,
    fiscal_code: null,
    birth_date: null,
    dog_address_line: null,
    dog_city: null,
    dog_zip_code: null,
    dog_province: null,
    id_document_path: null,
    id_document_uploaded_at: null,
  };
}

function sanitizeProfileSummaryForViewer(
  profile: Profile | ProfileSummaryRow | null | undefined
): Profile | ProfileSummaryRow | null {
  if (!profile) return null;
  return {
    ...profile,
    email: null,
    phone: null,
    city: null,
  };
}

function sanitizeProfileMapForVisibility(
  profileMap: Map<string, Profile | ProfileSummaryRow>,
  visibility: AdminVisibilityMode
): Map<string, Profile | ProfileSummaryRow> {
  if (visibility === 'full') return profileMap;

  const next = new Map<string, Profile | ProfileSummaryRow>();
  for (const [userId, profile] of profileMap.entries()) {
    const sanitized = sanitizeProfileSummaryForViewer(profile);
    if (sanitized) next.set(userId, sanitized);
  }
  return next;
}

function compareAscByStart(a: AdminAgendaItem, b: AdminAgendaItem): number {
  return a.startAt.localeCompare(b.startAt);
}

function compareDescByStart(a: AdminAgendaItem, b: AdminAgendaItem): number {
  return b.startAt.localeCompare(a.startAt);
}

function splitAgendaItems(items: AdminAgendaItem[]): {
  activeTimeline: AdminAgendaItem[];
  historyTimeline: AdminAgendaItem[];
} {
  return {
    activeTimeline: items.filter((item) => item.isActive).sort(compareAscByStart),
    historyTimeline: items.filter((item) => !item.isActive).sort(compareDescByStart),
  };
}

function extractIsoDatePrefix(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim();
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function normalizeTimeComponent(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return normalized;

  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
}

function buildDateTime(date: string, time?: string | null, endOfDay = false): string {
  if (!date) return '';
  const normalizedTime = normalizeTimeComponent(time);
  if (normalizedTime) return `${date}T${normalizedTime}`;
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function agendaItemFallsWithinDateRange(args: {
  startAt: string;
  endAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): boolean {
  const { startAt, endAt = null, startDate = null, endDate = null } = args;
  if (!startDate || !endDate) return true;

  const itemStart = Date.parse(startAt);
  const itemEnd = Date.parse(endAt ?? startAt);
  const rangeStart = Date.parse(buildDateTime(startDate));
  const rangeEnd = Date.parse(buildDateTime(endDate, null, true));

  if ([itemStart, itemEnd, rangeStart, rangeEnd].every((value) => !Number.isNaN(value))) {
    return itemStart <= rangeEnd && itemEnd >= rangeStart;
  }

  const itemStartDate = extractIsoDatePrefix(startAt);
  const itemEndDate = extractIsoDatePrefix(endAt ?? startAt);
  if (!itemStartDate || !itemEndDate) return true;

  return itemStartDate <= endDate && itemEndDate >= startDate;
}

function filterAgendaItemsByDateRange(
  items: AdminAgendaItem[],
  startDate: string,
  endDate: string
): AdminAgendaItem[] {
  return items.filter((item) =>
    agendaItemFallsWithinDateRange({
      startAt: item.startAt,
      endAt: item.endAt,
      startDate,
      endDate,
    })
  );
}

function uniqueAgendaItems(items: AdminAgendaItem[]): AdminAgendaItem[] {
  const map = new Map<string, AdminAgendaItem>();
  for (const item of items) {
    if (!map.has(item.itemKey)) map.set(item.itemKey, item);
  }
  return Array.from(map.values());
}

function compareAgendaUrgency(a: AdminAgendaItem, b: AdminAgendaItem, referenceDate: string): number {
  const aIsToday = agendaItemFallsWithinDateRange({
    startAt: a.startAt,
    endAt: a.endAt,
    startDate: referenceDate,
    endDate: referenceDate,
  });
  const bIsToday = agendaItemFallsWithinDateRange({
    startAt: b.startAt,
    endAt: b.endAt,
    startDate: referenceDate,
    endDate: referenceDate,
  });

  if (aIsToday !== bIsToday) return aIsToday ? -1 : 1;
  return compareAscByStart(a, b);
}

function isConfirmedRevenueStatus(status: BookingStatus | ServiceStatus | null | undefined): boolean {
  return status === 'CONFIRMED' || status === 'PAID' || status === 'COMPLETED';
}

/**
 * Debito ancora "in sospeso" nel saldo dell'utente: la prenotazione è confermata
 * ma NON ancora pagata. Quando passa a PAID (o viene annullata) esce dal saldo.
 */
function isOutstandingBalanceStatus(status: BookingStatus | ServiceStatus | null | undefined): boolean {
  return status === 'CONFIRMED' || status === 'COMPLETED';
}

function bookingExtraLabels(extrasList: Array<BookingDogExtras | null | undefined>): string[] {
  const labels = new Set<string>();

  for (const extras of extrasList) {
    if (!extras) continue;
    if (extras.grooming) labels.add('Toelettatura');
    if (extras.vaccine) labels.add('Vaccinazione');
    if ((extras.trackingSessions ?? 0) > 0) labels.add(`Ricerca olfattiva x${extras.trackingSessions}`);
    if ((extras.fitnessSessions ?? 0) > 0) labels.add(`Fitness x${extras.fitnessSessions}`);
    if ((extras.walkSessions ?? 0) > 0) labels.add(`Passeggiate x${extras.walkSessions}`);
    if ((extras.trekkingSessions ?? 0) > 0) labels.add(`Trekking x${extras.trekkingSessions}`);
    if (extras.therapyActive) labels.add('Terapia');
  }

  return Array.from(labels);
}

function countDogLabel(count: number): string {
  return `${count} cane${count === 1 ? '' : 'i'}`;
}

function buildPointDateTime(date: string, preferredTime?: string | null, fallbackTime = '12:00'): string {
  return buildDateTime(date, preferredTime ?? fallbackTime);
}

function formatWashingDifficultyLabel(value: Dog['grooming_difficulty'] | null | undefined): string | null {
  if (value === 1) return 'Bassa';
  if (value === 2) return 'Media';
  if (value === 3) return 'Alta';
  return null;
}

function formatServiceAddress(profile: Profile | ProfileSummaryRow | undefined): string | null {
  const line = String((profile as Profile | undefined)?.dog_address_line ?? '').trim();
  const city = String((profile as Profile | undefined)?.dog_city ?? '').trim();
  const zip = String((profile as Profile | undefined)?.dog_zip_code ?? '').trim();
  const province = String((profile as Profile | undefined)?.dog_province ?? '').trim();

  const parts = [line, [zip, city].filter(Boolean).join(' '), province].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function formatTimeOnly(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? normalized;
}

function buildSingleDogServiceSummaryLines(args: {
  bookingDog: BookingDogQueryRow;
  serviceKey: AdminServiceKey;
  profile?: Profile | ProfileSummaryRow;
  taxiLine?: string | null;
  taxiTime?: string | null;
  departureTime?: string | null;
}): string[] {
  const { bookingDog, serviceKey, profile, taxiLine = null, taxiTime = null, departureTime = null } = args;
  const lines: string[] = [];
  const extras = bookingDog.extras ?? null;
  const dog = firstRelation(bookingDog.dogs);

  if (serviceKey === 'TRACKING' && (extras?.trackingSessions ?? 0) > 0) {
    const count = extras?.trackingSessions ?? 0;
    lines.push(`${count} session${count === 1 ? 'e' : 'i'} ricerca olfattiva`);
  }

  if (serviceKey === 'FITNESS' && (extras?.fitnessSessions ?? 0) > 0) {
    const count = extras?.fitnessSessions ?? 0;
    lines.push(`${count} session${count === 1 ? 'e' : 'i'} fitness`);
  }

  if (serviceKey === 'PASSEGGIATA' && (extras?.walkSessions ?? 0) > 0) {
    const count = extras?.walkSessions ?? 0;
    lines.push(`${count} passeggiat${count === 1 ? 'a' : 'e'}`);
  }

  if (serviceKey === 'TREKKING' && (extras?.trekkingSessions ?? 0) > 0) {
    const count = extras?.trekkingSessions ?? 0;
    lines.push(`${count} session${count === 1 ? 'e' : 'i'} trekking`);
  }

  if (serviceKey === 'TERAPIA' && extras?.therapyActive) {
    const therapyNotes = String(extras.therapyNotes ?? '').trim();
    lines.push(therapyNotes || 'Terapia attiva');
  }

  if (serviceKey === 'VACCINAZIONE' && extras?.vaccine) {
    lines.push('Vaccinazione richiesta');
  }

  if (serviceKey === 'TOELETTATURA' && extras?.grooming) {
    const normalizedDepartureTime = formatTimeOnly(departureTime);
    if (normalizedDepartureTime) {
      lines.push(`Partenza: ${normalizedDepartureTime}`);
    }
    const washingDifficulty = formatWashingDifficultyLabel(dog?.grooming_difficulty ?? null);
    if (washingDifficulty) {
      lines.push(`Lavaggio: ${washingDifficulty}`);
    }
  }

  if (serviceKey === 'TAXI_DOG') {
    if (taxiLine) {
      lines.push(taxiLine);
    }
    const normalizedTaxiTime = formatTimeOnly(taxiTime);
    if (normalizedTaxiTime) {
      lines.push(`Orario: ${normalizedTaxiTime}`);
    }
    const address = formatServiceAddress(profile);
    if (address) {
      lines.push(address);
    }
  }

  return lines;
}

function mapDocumentRow(
  row: UserDocumentRow,
  signedUrl: string | null,
  ownerName: string | null = null
): AdminDocumentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    ownerName,
    kind: row.kind,
    path: row.path,
    fileName: fileNameFromPath(row.path),
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at,
    staffNote: row.staff_note,
    signedUrl,
  };
}

async function createSignedUrl(path: string): Promise<string | null> {
  const trimmed = String(path ?? '').trim();
  if (!trimmed) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(IDENTITY_BUCKET)
    .createSignedUrl(trimmed, 60 * 15);

  if (error) return null;
  return data?.signedUrl ?? null;
}

async function loadProfilesByIds(userIds: string[]): Promise<Map<string, Profile | ProfileSummaryRow>> {
  const ids = unique(userIds.filter(Boolean));
  const profileMap = new Map<string, Profile | ProfileSummaryRow>();

  if (ids.length === 0) return profileMap;

  const { data } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('user_id', ids);

  for (const row of (data ?? []) as Array<Profile | ProfileSummaryRow>) {
    profileMap.set(row.user_id, row);
  }

  return profileMap;
}

function formatDocumentOwnerName(profile: Profile | ProfileSummaryRow | null | undefined): string | null {
  if (!profile) return null;
  return formatPersonName(profile.first_name ?? null, profile.last_name ?? null, profile.email ?? null);
}

async function loadStaffRoleMap(userIds: string[]): Promise<Map<string, StaffRole>> {
  const ids = unique(userIds.filter(Boolean));
  const roleMap = new Map<string, StaffRole>();

  if (ids.length === 0) return roleMap;

  const { data } = await supabaseAdmin
    .from('staff_accounts')
    .select('user_id, role, is_active')
    .in('user_id', ids);

  for (const row of (data ?? []) as Array<Pick<StaffAccountRow, 'user_id' | 'role' | 'is_active'>>) {
    if (row.is_active) {
      roleMap.set(row.user_id, row.role);
    }
  }

  return roleMap;
}

async function loadDogsByOwnerIds(ownerIds: string[]): Promise<DogSummaryRow[]> {
  const ids = unique(ownerIds.filter(Boolean));
  if (ids.length === 0) return [];

  const { data } = await supabaseAdmin
    .from('dogs')
    .select('id, owner_id, name, breed, microchip, size_category, is_active')
    .in('owner_id', ids)
    .neq('is_active', false)
    .order('name', { ascending: true });

  return ((data ?? []) as DogSummaryRow[]).filter((dog) => dog.is_active !== false);
}

async function loadDogsByIds(dogIds: string[]): Promise<Map<string, Dog>> {
  const ids = unique(dogIds.filter(Boolean));
  const dogMap = new Map<string, Dog>();

  if (ids.length === 0) return dogMap;

  const { data } = await supabaseAdmin
    .from('dogs')
    .select(DOG_SELECT)
    .in('id', ids);

  for (const row of (data ?? []) as Dog[]) {
    dogMap.set(row.id, row);
  }

  return dogMap;
}

async function loadUserDocumentsByUserIds(userIds: string[]): Promise<UserDocumentRow[]> {
  const ids = unique(userIds.filter(Boolean));
  if (ids.length === 0) return [];

  const { data } = await supabaseAdmin
    .from('user_documents')
    .select('id, user_id, kind, path, created_at, status, accepted_at, rejected_at, staff_note')
    .in('user_id', ids)
    .order('created_at', { ascending: false });

  return (data ?? []) as UserDocumentRow[];
}

async function loadActiveBookingCountsForUsers(userIds: string[]): Promise<Map<string, number>> {
  const ids = unique(userIds.filter(Boolean));
  const counts = new Map<string, number>();

  if (ids.length === 0) return counts;

  const [pensioneRows, slotRows] = await Promise.all([
    fetchPensioneBookingsForUsers(ids),
    fetchServiceSlotBookingsForUsers(ids),
  ]);

  for (const row of pensioneRows) {
    const status = deriveAgendaStatus(row.status ?? null, completionCutoffEndOfDay(row.end_date ?? row.start_date));
    if (!isActiveBookingStatus(status)) continue;
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }

  for (const row of slotRows) {
    const slot = firstRelation(row.service_slots);
    const status = deriveAgendaStatus(
      row.status ?? null,
      completionCutoffEndOfDay(slot?.end_at ?? slot?.start_at ?? null)
    );
    if (!isActiveBookingStatus(status)) continue;
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }

  return counts;
}

async function loadActiveBookingCountsForDogs(dogIds: string[]): Promise<Map<string, number>> {
  const ids = unique(dogIds.filter(Boolean));
  const counts = new Map<string, number>();

  if (ids.length === 0) return counts;

  const [bookingDogsRes, slotBookingsRes, legacySlotBookingsRes] = await Promise.all([
    supabaseAdmin
      .from('booking_dogs')
      .select('dog_id, bookings!inner(status, start_date, end_date)')
      .in('dog_id', ids),
    supabaseAdmin
      .from('service_slot_bookings')
      .select('id, dog_id, dog_ids, status, service_slots(id, start_at, end_at, capacity, service_type, service_variant)')
      .overlaps('dog_ids', ids),
    supabaseAdmin
      .from('service_slot_bookings')
      .select('id, dog_id, dog_ids, status, service_slots(id, start_at, end_at, capacity, service_type, service_variant)')
      .in('dog_id', ids),
  ]);

  for (const row of (bookingDogsRes.data ?? []) as Array<{
    dog_id: string;
    bookings?: { status?: BookingStatus | null; start_date?: string | null; end_date?: string | null } | Array<{
      status?: BookingStatus | null;
      start_date?: string | null;
      end_date?: string | null;
    }> | null;
  }>) {
    const booking = firstRelation(row.bookings);
    const status = deriveAgendaStatus(
      booking?.status ?? null,
      completionCutoffEndOfDay(booking?.end_date ?? booking?.start_date ?? null)
    );
    if (!isActiveBookingStatus(status)) continue;
    counts.set(row.dog_id, (counts.get(row.dog_id) ?? 0) + 1);
  }

  const slotRowsById = new Map<string, Pick<ServiceSlotBookingQueryRow, 'id' | 'dog_id' | 'dog_ids' | 'status' | 'service_slots'>>();
  for (const row of (slotBookingsRes.data ?? []) as Array<Pick<ServiceSlotBookingQueryRow, 'id' | 'dog_id' | 'dog_ids' | 'status' | 'service_slots'>>) {
    slotRowsById.set(row.id, row);
  }
  for (const row of (legacySlotBookingsRes.data ?? []) as Array<Pick<ServiceSlotBookingQueryRow, 'id' | 'dog_id' | 'dog_ids' | 'status' | 'service_slots'>>) {
    slotRowsById.set(row.id, row);
  }

  for (const row of slotRowsById.values()) {
    const slot = firstRelation(row.service_slots);
    const status = deriveAgendaStatus(
      row.status ?? null,
      completionCutoffEndOfDay(slot?.end_at ?? slot?.start_at ?? null)
    );
    if (!isActiveBookingStatus(status)) continue;

    for (const dogId of slotBookingDogIds(row)) {
      if (!counts.has(dogId)) counts.set(dogId, 0);
      counts.set(dogId, (counts.get(dogId) ?? 0) + 1);
    }
  }

  return counts;
}

function buildPensioneAgendaItems(args: {
  rows: PensioneBookingQueryRow[];
  profileMap: Map<string, Profile | ProfileSummaryRow>;
  filterKey?: AdminServiceKey | null;
  startDate?: string | null;
  endDate?: string | null;
}): AdminAgendaItem[] {
  const { rows, profileMap, filterKey = null, startDate = null, endDate = null } = args;

  return rows.flatMap((row) => {
    const profile = profileMap.get(row.user_id);
    const serviceType = row.service_type === 'TARGHETTA' ? null : row.service_type;
    const bookingDogs = row.booking_dogs ?? [];
    const dogNames = unique(
      bookingDogs
        .map((bookingDog) => firstRelation(bookingDog.dogs)?.name ?? '')
        .map((name) => name.trim())
        .filter(Boolean)
    );
    const extrasList = bookingDogs.map((bookingDog) => bookingDog.extras ?? null);
    const extraLabels = bookingExtraLabels(extrasList);
    const serviceKeys: AdminServiceKey[] = filterKey
      ? [filterKey]
      : ['PENSIONE'];

    return serviceKeys
      .filter((serviceKey) => {
        if (serviceKey === 'PENSIONE') return true;

        const matchesExtras = extrasList.some((extras) =>
          bookingMatchesServiceKey({
            serviceType,
            extras: extras ?? null,
            taxiOption: row.taxi_option ?? null,
            filterKey: serviceKey,
          })
        );

        const matchesWithoutExtras = bookingMatchesServiceKey({
          serviceType,
          taxiOption: row.taxi_option ?? null,
          filterKey: serviceKey,
        });

        return matchesExtras || matchesWithoutExtras;
      })
      .flatMap((serviceKey): AdminAgendaItem[] => {
        const derivedStatus = deriveAgendaStatus(
          row.status ?? null,
          completionCutoffEndOfDay(row.end_date ?? row.start_date)
        );
        const defaultStartAt = buildDateTime(row.start_date, row.arrival_time ?? null);
        const defaultEndAt = row.end_date ? buildDateTime(row.end_date, row.departure_time ?? null, true) : null;
        const userName = formatPersonName(profile?.first_name ?? null, profile?.last_name ?? null, profile?.email ?? null);
        const serviceLabel = getAdminServiceLabel(serviceKey, serviceType, null);

        if (!filterKey || filterKey === 'PENSIONE') {
          const meta = [countDogLabel(dogNames.length)];
          meta.push(...extraLabels);
          if (row.taxi_option && row.taxi_option !== 'NONE') meta.push('Taxi dog');

          return [{
            itemKey: `PENSIONE:${row.id}:${serviceKey}:default`,
            kind: 'PENSIONE',
            id: row.id,
            userId: row.user_id,
            userName,
            userEmail: profile?.email ?? null,
            dogNames,
            serviceKey,
            serviceType,
            serviceVariant: null,
            serviceLabel,
            status: derivedStatus,
            startAt: defaultStartAt,
            endAt: defaultEndAt,
            totalPrice: row.total_price ?? null,
            notes: row.notes ?? null,
            isActive: isActiveBookingStatus(derivedStatus),
            meta,
            summaryLines: [],
          } satisfies AdminAgendaItem];
        }

        if (serviceKey === 'TAXI_DOG') {
          const taxiItemsByDog = bookingDogs.flatMap((bookingDog) => {
            const dog = firstRelation(bookingDog.dogs);
            const dogName = (dog?.name ?? '').trim() || 'Cane';
            const lastDay = row.end_date ?? row.start_date;

            if (row.taxi_option === 'ONE_WAY') {
              return [{
                itemKey: `PENSIONE:${row.id}:TAXI_DOG:${bookingDog.dog_id}:andata`,
                kind: 'PENSIONE',
                id: row.id,
                userId: row.user_id,
                userName,
                userEmail: profile?.email ?? null,
                dogNames: [dogName],
                serviceKey,
                serviceType,
                serviceVariant: null,
                serviceLabel,
                status: derivedStatus,
                startAt: buildPointDateTime(row.start_date, row.taxi_pickup_time ?? row.arrival_time ?? null),
                endAt: null,
                totalPrice: row.total_price ?? null,
                notes: row.notes ?? null,
                isActive: isActiveBookingStatus(derivedStatus),
                meta: [],
                summaryLines: buildSingleDogServiceSummaryLines({
                  bookingDog,
                  serviceKey,
                  profile,
                  taxiLine: 'Solo andata',
                  taxiTime: row.taxi_pickup_time ?? row.arrival_time ?? null,
                }),
              } satisfies AdminAgendaItem];
            }

            if (row.taxi_option === 'RETURN_ONLY') {
              return [{
                itemKey: `PENSIONE:${row.id}:TAXI_DOG:${bookingDog.dog_id}:ritorno`,
                kind: 'PENSIONE',
                id: row.id,
                userId: row.user_id,
                userName,
                userEmail: profile?.email ?? null,
                dogNames: [dogName],
                serviceKey,
                serviceType,
                serviceVariant: null,
                serviceLabel,
                status: derivedStatus,
                startAt: buildPointDateTime(lastDay, row.taxi_return_time ?? row.departure_time ?? null),
                endAt: null,
                totalPrice: row.total_price ?? null,
                notes: row.notes ?? null,
                isActive: isActiveBookingStatus(derivedStatus),
                meta: [],
                summaryLines: buildSingleDogServiceSummaryLines({
                  bookingDog,
                  serviceKey,
                  profile,
                  taxiLine: 'Solo ritorno',
                  taxiTime: row.taxi_return_time ?? row.departure_time ?? null,
                }),
              } satisfies AdminAgendaItem];
            }

            if (row.taxi_option === 'ROUND_TRIP') {
              return [
                {
                  itemKey: `PENSIONE:${row.id}:TAXI_DOG:${bookingDog.dog_id}:andata`,
                  kind: 'PENSIONE',
                  id: row.id,
                  userId: row.user_id,
                  userName,
                  userEmail: profile?.email ?? null,
                  dogNames: [dogName],
                  serviceKey,
                  serviceType,
                  serviceVariant: null,
                  serviceLabel,
                  status: derivedStatus,
                  startAt: buildPointDateTime(row.start_date, row.taxi_pickup_time ?? row.arrival_time ?? null),
                  endAt: null,
                  totalPrice: row.total_price ?? null,
                  notes: row.notes ?? null,
                  isActive: isActiveBookingStatus(derivedStatus),
                  meta: [],
                  summaryLines: buildSingleDogServiceSummaryLines({
                    bookingDog,
                    serviceKey,
                    profile,
                    taxiLine: 'Andata',
                    taxiTime: row.taxi_pickup_time ?? row.arrival_time ?? null,
                  }),
                } satisfies AdminAgendaItem,
                {
                  itemKey: `PENSIONE:${row.id}:TAXI_DOG:${bookingDog.dog_id}:ritorno`,
                  kind: 'PENSIONE',
                  id: row.id,
                  userId: row.user_id,
                  userName,
                  userEmail: profile?.email ?? null,
                  dogNames: [dogName],
                  serviceKey,
                  serviceType,
                  serviceVariant: null,
                  serviceLabel,
                  status: derivedStatus,
                  startAt: buildPointDateTime(lastDay, row.taxi_return_time ?? row.departure_time ?? null),
                  endAt: null,
                  totalPrice: row.total_price ?? null,
                  notes: row.notes ?? null,
                  isActive: isActiveBookingStatus(derivedStatus),
                  meta: [],
                  summaryLines: buildSingleDogServiceSummaryLines({
                    bookingDog,
                    serviceKey,
                    profile,
                    taxiLine: 'Ritorno',
                    taxiTime: row.taxi_return_time ?? row.departure_time ?? null,
                  }),
                } satisfies AdminAgendaItem,
              ];
            }

            return [];
          });

          return taxiItemsByDog.filter((item) =>
            agendaItemFallsWithinDateRange({
              startAt: item.startAt,
              endAt: item.endAt,
              startDate,
              endDate,
            })
          );
        }

        const filteredDogItems = bookingDogs
          .filter((bookingDog) =>
            bookingMatchesServiceKey({
              serviceType,
              extras: bookingDog.extras ?? null,
              taxiOption: row.taxi_option ?? null,
              filterKey: serviceKey,
            })
          )
          .map((bookingDog) => {
            const dog = firstRelation(bookingDog.dogs);
            const dogName = (dog?.name ?? '').trim() || 'Cane';
            const lastDay = row.end_date ?? row.start_date;
            const startAt =
              serviceKey === 'TOELETTATURA'
                ? buildPointDateTime(lastDay, row.departure_time ?? row.arrival_time ?? null)
                : defaultStartAt;
            const endAt = serviceKey === 'TOELETTATURA' ? null : defaultEndAt;

            return {
              itemKey: `PENSIONE:${row.id}:${serviceKey}:${bookingDog.dog_id}`,
              kind: 'PENSIONE',
              id: row.id,
              userId: row.user_id,
              userName,
              userEmail: profile?.email ?? null,
              dogNames: [dogName],
              serviceKey,
              serviceType,
              serviceVariant: null,
              serviceLabel,
              status: derivedStatus,
              startAt,
              endAt,
              totalPrice: row.total_price ?? null,
              notes: row.notes ?? null,
              isActive: isActiveBookingStatus(derivedStatus),
              meta: [],
              summaryLines: buildSingleDogServiceSummaryLines({
                bookingDog,
                serviceKey,
                departureTime: row.departure_time ?? null,
              }),
            } satisfies AdminAgendaItem;
          });

        return filteredDogItems.filter((item) =>
          agendaItemFallsWithinDateRange({
            startAt: item.startAt,
            endAt: item.endAt,
            startDate,
            endDate,
          })
        );
      });
  });
}

function buildServiceSlotAgendaItems(args: {
  rows: ServiceSlotBookingQueryRow[];
  profileMap: Map<string, Profile | ProfileSummaryRow>;
  dogMap: Map<string, Dog>;
  filterKey?: AdminServiceKey | null;
}): AdminAgendaItem[] {
  const { rows, profileMap, dogMap, filterKey = null } = args;

  return rows.flatMap((row) => {
    const profile = profileMap.get(row.user_id);
    const slot = firstRelation(row.service_slots);
    const dogNames = unique(
      slotBookingDogIds(row)
        .map((dogId) => dogMap.get(dogId)?.name ?? '')
        .map((name) => name.trim())
        .filter(Boolean)
    );
    const candidates = filterKey
      ? [filterKey]
      : [row.service_type ?? slot?.service_type ?? 'CONSULENZA'];

    return candidates
      .filter((candidate) =>
        bookingMatchesServiceKey({
          serviceType: row.service_type ?? slot?.service_type ?? null,
          taxiEnabled: row.taxi_enabled,
          filterKey: candidate,
        })
      )
      .map((serviceKey) => {
        const meta = [countDogLabel(dogNames.length)];
        if (row.taxi_enabled) meta.push('Taxi dog');
        if (row.taxi_distance_km) meta.push(`${row.taxi_distance_km} km`);
        const derivedStatus = deriveAgendaStatus(
          row.status ?? null,
          completionCutoffEndOfDay(slot?.end_at ?? slot?.start_at ?? null)
        );
        const summaryLines =
          filterKey === 'TAXI_DOG'
            ? [
                `Servizio collegato: ${getAdminServiceLabel(
                  (row.service_type ?? slot?.service_type ?? 'CONSULENZA') as AdminServiceKey,
                  row.service_type ?? slot?.service_type ?? null,
                  row.service_variant ?? slot?.service_variant ?? null
                )}`,
              ]
            : [];

        return {
          itemKey: `SERVICE_SLOT:${row.id}:${serviceKey}`,
          kind: 'SERVICE_SLOT',
          id: row.id,
          userId: row.user_id,
          userName: formatPersonName(profile?.first_name ?? null, profile?.last_name ?? null, profile?.email ?? null),
          userEmail: profile?.email ?? null,
          dogNames,
          serviceKey,
          serviceType: row.service_type ?? slot?.service_type ?? null,
          serviceVariant: row.service_variant ?? slot?.service_variant ?? null,
          serviceLabel: getAdminServiceLabel(
            serviceKey,
            row.service_type ?? slot?.service_type ?? null,
            row.service_variant ?? slot?.service_variant ?? null
          ),
          status: derivedStatus,
          startAt: slot?.start_at ?? row.created_at,
          endAt: slot?.end_at ?? null,
          totalPrice: row.total_price ?? null,
          notes: row.notes ?? null,
          isActive: isActiveBookingStatus(derivedStatus),
          meta,
          summaryLines,
        } satisfies AdminAgendaItem;
      });
  });
}

async function fetchPensioneBookingsForUsers(userIds: string[]): Promise<PensioneBookingQueryRow[]> {
  const ids = unique(userIds.filter(Boolean));
  if (ids.length === 0) return [];

  const { data } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, user_id, service_type, start_date, end_date, arrival_time, departure_time, status, notes, total_price, taxi_option, taxi_distance_band, taxi_price, taxi_pickup_time, taxi_return_time, booking_dogs(id, booking_id, dog_id, accommodation_type, accommodation_price_per_day, days_count, accommodation_subtotal, extras, extras_subtotal, per_dog_total, dogs(id, name, breed, grooming_difficulty))'
    )
    .in('user_id', ids)
    .order('start_date', { ascending: false });

  return (data ?? []) as PensioneBookingQueryRow[];
}

async function fetchServiceSlotBookingsForUsers(userIds: string[]): Promise<ServiceSlotBookingQueryRow[]> {
  const ids = unique(userIds.filter(Boolean));
  if (ids.length === 0) return [];

  const { data } = await supabaseAdmin
    .from('service_slot_bookings')
    .select(
      'id, user_id, service_type, service_variant, slot_id, dog_id, dog_ids, taxi_enabled, taxi_distance_km, taxi_price_eur, total_price, pass_id, credits_spent, status, notes, created_at, service_slots(id, start_at, end_at, capacity, service_type, service_variant)'
    )
    .in('user_id', ids)
    .order('created_at', { ascending: false });

  return (data ?? []) as ServiceSlotBookingQueryRow[];
}

async function fetchAgendaDataByRange(args: {
  startDate: string;
  endDate: string;
}): Promise<{
  profileMap: Map<string, Profile | ProfileSummaryRow>;
  dogMap: Map<string, Dog>;
  pensioneRows: PensioneBookingQueryRow[];
  slotRows: ServiceSlotBookingQueryRow[];
}> {
  const { startDate, endDate } = args;

  const pensioneQuery = supabaseAdmin
    .from('bookings')
    .select(
      'id, user_id, service_type, start_date, end_date, arrival_time, departure_time, status, notes, total_price, taxi_option, taxi_distance_band, taxi_price, taxi_pickup_time, taxi_return_time, booking_dogs(id, booking_id, dog_id, accommodation_type, accommodation_price_per_day, days_count, accommodation_subtotal, extras, extras_subtotal, per_dog_total, dogs(id, name, breed, grooming_difficulty))'
    )
    .lte('start_date', endDate)
    .or(`end_date.is.null,end_date.gte.${startDate}`);

  const slotQuery = supabaseAdmin
    .from('service_slot_bookings')
    .select(
      'id, user_id, service_type, service_variant, slot_id, dog_id, dog_ids, taxi_enabled, taxi_distance_km, taxi_price_eur, total_price, pass_id, credits_spent, status, notes, created_at, service_slots!inner(id, start_at, end_at, capacity, service_type, service_variant)'
    )
    .gte('service_slots.start_at', `${startDate}T00:00:00`)
    .lte('service_slots.start_at', `${endDate}T23:59:59`);

  const [pensioneRes, slotRes] = await Promise.all([
    pensioneQuery.order('start_date', { ascending: true }),
    slotQuery.order('start_at', { ascending: true, referencedTable: 'service_slots' }),
  ]);

  const pensioneRows = (pensioneRes.data ?? []) as PensioneBookingQueryRow[];
  const slotRows = (slotRes.data ?? []) as ServiceSlotBookingQueryRow[];

  const userIds = unique([
    ...pensioneRows.map((row) => row.user_id),
    ...slotRows.map((row) => row.user_id),
  ]);
  const dogIds = unique(slotRows.flatMap((row) => slotBookingDogIds(row)));

  const [profileMap, dogMap] = await Promise.all([
    loadProfilesByIds(userIds),
    loadDogsByIds(dogIds),
  ]);

  return { profileMap, dogMap, pensioneRows, slotRows };
}

function filterAgendaByStatus(
  items: AdminAgendaItem[],
  status: string | null | undefined
): AdminAgendaItem[] {
  if (!status || status === 'ALL') return items;
  return items.filter((item) => item.status === status);
}

function slotServiceTypesFromKeys(serviceKeys: AdminServiceKey[]): ServiceType[] | 'ALL' {
  if (serviceKeys.length === 0) return 'ALL';

  const mapped = Array.from(
    new Set(
      serviceKeys
        .filter(
          (serviceKey): serviceKey is Extract<AdminServiceKey, 'PENSIONE' | 'ASILO' | 'ADDESTRAMENTO' | 'CONSULENZA'> =>
            serviceKey === 'PENSIONE' ||
            serviceKey === 'ASILO' ||
            serviceKey === 'ADDESTRAMENTO' ||
            serviceKey === 'CONSULENZA'
        )
    )
  );

  if (mapped.length === 0) return [];
  if (mapped.length === 4) return 'ALL';
  return mapped;
}

function sanitizeUserListItemVisibility(item: AdminUserListItem, visibility: AdminVisibilityMode): AdminUserListItem {
  if (visibility === 'full') return item;
  // I VIEWER vedono il saldo (walletDue) ma non i contatti/documenti.
  return {
    ...item,
    email: null,
    phone: null,
    city: null,
    staffRole: null,
    pendingDocuments: 0,
  };
}

function sanitizeDogListItemVisibility(item: AdminDogListItem, visibility: AdminVisibilityMode): AdminDogListItem {
  if (visibility === 'full') return item;
  return {
    ...item,
    ownerEmail: null,
    ownerPhone: null,
    staffRole: null,
  };
}

export async function searchAdminUsers(
  search: string,
  limit = 40,
  visibility: AdminVisibilityMode = 'full'
): Promise<AdminUserListItem[]> {
  const term = sanitizeSearchTerm(search).toLowerCase();
  const tokens = normalizeSearchTokens(term);
  const profileSearchOr = buildTokenSearchOr(
    ['first_name', 'last_name', 'email', 'phone', 'city', 'fiscal_code', 'address_line', 'province'],
    tokens
  );
  const dogSearchOr = buildTokenSearchOr(['name', 'breed', 'microchip'], tokens);

  const [profileRes, dogRes] = await Promise.all([
    term
      ? supabaseAdmin
          .from('profiles')
          .select('user_id, first_name, last_name, phone, email, city')
          .is('deleted_at', null)
          .or(profileSearchOr)
          .limit(limit * 3)
      : supabaseAdmin
          .from('profiles')
          .select('user_id, first_name, last_name, phone, email, city')
          .is('deleted_at', null)
          .order('last_name', { ascending: true })
          .order('first_name', { ascending: true })
          .limit(limit),
    term
      ? supabaseAdmin
          .from('dogs')
          .select('id, owner_id, name, breed, microchip, size_category, is_active')
          .or(dogSearchOr)
          .neq('is_active', false)
          .limit(limit * 3)
      : Promise.resolve({ data: [] as DogSummaryRow[] }),
  ]);

  const profileRows = (profileRes.data ?? []) as ProfileSummaryRow[];
  const dogRows = ((dogRes.data ?? []) as DogSummaryRow[]).filter((dog) => dog.is_active !== false);

  const candidateUserIds = unique([
    ...profileRows.map((row) => row.user_id),
    ...dogRows.map((row) => row.owner_id),
  ]);

  const userIds = candidateUserIds.slice(0, limit * 3);

  const [allProfilesMap, allDogs, activeCounts, userDocuments, staffRoles] = await Promise.all([
    loadProfilesByIds(userIds),
    loadDogsByOwnerIds(userIds),
    loadActiveBookingCountsForUsers(userIds),
    loadUserDocumentsByUserIds(userIds),
    loadStaffRoleMap(userIds),
  ]);

  const pendingDocumentCounts = new Map<string, number>();
  for (const document of userDocuments) {
    if (document.status !== 'PENDING') continue;
    pendingDocumentCounts.set(document.user_id, (pendingDocumentCounts.get(document.user_id) ?? 0) + 1);
  }

  const dogsByOwner = new Map<string, DogSummaryRow[]>();
  for (const dog of allDogs) {
    const rows = dogsByOwner.get(dog.owner_id) ?? [];
    rows.push(dog);
    dogsByOwner.set(dog.owner_id, rows);
  }

  return userIds
    .filter((userId) => {
      // Esclude gli utenti soft-deleted (anche se emersi da una ricerca cane).
      if ((allProfilesMap.get(userId) as Profile | undefined)?.deleted_at) return false;
      if (!term) return true;
      const profile = allProfilesMap.get(userId);
      const dogs = dogsByOwner.get(userId) ?? [];
      return matchesSearch(buildProfileSearchHaystack(profile, dogs), term, tokens);
    })
    .slice(0, limit)
    .map((userId) => {
      const profile = allProfilesMap.get(userId);
      const dogs = dogsByOwner.get(userId) ?? [];

      return sanitizeUserListItemVisibility(
        {
          userId,
          fullName: formatPersonName(
            profile?.first_name ?? null,
            profile?.last_name ?? null,
            visibility === 'full' ? profile?.email ?? null : null
          ),
          email: profile?.email ?? null,
          phone: profile?.phone ?? null,
          city: profile?.city ?? null,
          dogsCount: dogs.length,
          activeBookings: activeCounts.get(userId) ?? 0,
          pendingDocuments: pendingDocumentCounts.get(userId) ?? 0,
          dogNames: dogs.map((dog) => dog.name).filter(Boolean) as string[],
          staffRole: staffRoles.get(userId) ?? null,
          walletDue: Number(
            (profile as { wallet_due_eur?: number | null } | undefined)?.wallet_due_eur ?? 0
          ),
        } satisfies AdminUserListItem,
        visibility
      );
    });
}

export async function getAdminUserDetail(
  userId: string,
  visibility: AdminVisibilityMode = 'full'
): Promise<AdminUserDetail | null> {
  const [profileRes, dogsRes, passesRes, documentsRes, staffRole, pensioneRows, slotRows] = await Promise.all([
    supabaseAdmin.from('profiles').select(PROFILE_SELECT).eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('dogs').select(DOG_SELECT).eq('owner_id', userId).order('name', { ascending: true }),
    supabaseAdmin
      .from('service_passes')
      .select('id, user_id, service_type, service_variant, product_id, credits_total, credits_used, status, purchased_at, expires_at, unlocked_at, unlocked_by')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false }),
    supabaseAdmin
      .from('user_documents')
      .select('id, user_id, kind, path, created_at, status, accepted_at, rejected_at, staff_note')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    getStaffRoleForUserInternal(userId),
    fetchPensioneBookingsForUsers([userId]),
    fetchServiceSlotBookingsForUsers([userId]),
  ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const dogs = ((dogsRes.data ?? []) as Dog[]).filter((dog) => dog.is_active !== false);

  if (!profile && dogs.length === 0 && pensioneRows.length === 0 && slotRows.length === 0) {
    return null;
  }

  const dogMap = await loadDogsByIds(unique((slotRows as ServiceSlotBookingQueryRow[]).flatMap((row) => slotBookingDogIds(row))));
  const profileMap = new Map<string, Profile | ProfileSummaryRow>();
  if (profile) {
    profileMap.set(
      userId,
      visibility === 'full' ? profile : (sanitizeProfileSummaryForViewer(profile) as Profile)
    );
  }

  const combinedTimeline = [
    ...buildPensioneAgendaItems({ rows: pensioneRows, profileMap }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
  ];
  const { activeTimeline, historyTimeline } = splitAgendaItems(combinedTimeline);

  const documents =
    visibility === 'full'
      ? await Promise.all(
          ((documentsRes.data ?? []) as UserDocumentRow[]).map(async (row) =>
            mapDocumentRow(row, await createSignedUrl(row.path), formatDocumentOwnerName(profile))
          )
        )
      : [];

  return {
    userId,
    profile: visibility === 'full' ? profile : sanitizeProfileForViewer(profile),
    staffRole: visibility === 'full' ? staffRole : null,
    dogs,
    // Saldo e pacchetti crediti sono visibili anche ai VIEWER (sola lettura).
    servicePasses: (passesRes.data ?? []) as ServicePassRow[],
    documents,
    activeTimeline,
    historyTimeline,
    // Calcolato sul profilo REALE (non oscurato), così i mancanti restano accurati per i VIEWER.
    ownerMissing: buildRequiredOwnerMissing(profile),
  };
}

export async function searchAdminDogs(
  search: string,
  limit = 50,
  visibility: AdminVisibilityMode = 'full'
): Promise<AdminDogListItem[]> {
  const term = sanitizeSearchTerm(search).toLowerCase();
  const tokens = normalizeSearchTokens(term);
  const dogSearchOr = buildTokenSearchOr(['name', 'breed', 'microchip'], tokens);
  const profileSearchOr = buildTokenSearchOr(['first_name', 'last_name', 'email', 'phone', 'city'], tokens);

  const [dogsRes, ownerProfilesRes] = await Promise.all([
    term
      ? supabaseAdmin
          .from('dogs')
          .select('id, owner_id, name, breed, microchip, size_category, is_active')
          .or(dogSearchOr)
          .neq('is_active', false)
          .limit(limit * 3)
      : supabaseAdmin
          .from('dogs')
          .select('id, owner_id, name, breed, microchip, size_category, is_active')
          .neq('is_active', false)
          .limit(limit)
          .order('name', { ascending: true }),
    term
      ? supabaseAdmin
          .from('profiles')
          .select('user_id, first_name, last_name, phone, email, city')
          .or(profileSearchOr)
          .limit(limit * 3)
      : Promise.resolve({ data: [] as ProfileSummaryRow[] }),
  ]);

  const directDogs = ((dogsRes.data ?? []) as DogSummaryRow[]).filter((dog) => dog.is_active !== false);
  const ownerProfileRows = (ownerProfilesRes.data ?? []) as ProfileSummaryRow[];

  const ownerIdsFromSearch = ownerProfileRows.map((row) => row.user_id);

  const ownerDogsRes = ownerIdsFromSearch.length
    ? await supabaseAdmin
        .from('dogs')
        .select('id, owner_id, name, breed, microchip, size_category, is_active')
        .in('owner_id', ownerIdsFromSearch)
        .neq('is_active', false)
        .limit(limit)
    : { data: [] as DogSummaryRow[] };

  const dogs = unique(
    [...directDogs, ...(((ownerDogsRes.data ?? []) as DogSummaryRow[]).filter((dog) => dog.is_active !== false))]
      .map((dog) => dog.id)
  )
    .map((dogId) => {
      return [...directDogs, ...((ownerDogsRes.data ?? []) as DogSummaryRow[])].find((dog) => dog.id === dogId);
    })
    .filter(Boolean) as DogSummaryRow[];

  const ownerIds = unique(dogs.map((dog) => dog.owner_id));
  const [profilesMap, activeCounts, staffRoles] = await Promise.all([
    loadProfilesByIds(ownerIds),
    loadActiveBookingCountsForDogs(dogs.map((dog) => dog.id)),
    loadStaffRoleMap(ownerIds),
  ]);

  return dogs
    .filter((dog) => {
      // Nasconde i cani di clienti soft-deleted.
      if ((profilesMap.get(dog.owner_id) as Profile | undefined)?.deleted_at) return false;
      if (!term) return true;
      const owner = profilesMap.get(dog.owner_id);
      return matchesSearch(buildDogSearchHaystack(dog, owner), term, tokens);
    })
    .slice(0, limit)
    .map((dog) => {
      const owner = profilesMap.get(dog.owner_id);
      return sanitizeDogListItemVisibility(
        {
          dogId: dog.id,
          name: dog.name,
          breed: dog.breed ?? null,
          microchip: dog.microchip ?? null,
          sizeCategory: dog.size_category ?? null,
          ownerId: dog.owner_id,
          ownerName: formatPersonName(
            owner?.first_name ?? null,
            owner?.last_name ?? null,
            visibility === 'full' ? owner?.email ?? null : null
          ),
          ownerEmail: owner?.email ?? null,
          ownerPhone: owner?.phone ?? null,
          activeBookings: activeCounts.get(dog.id) ?? 0,
          staffRole: staffRoles.get(dog.owner_id) ?? null,
        } satisfies AdminDogListItem,
        visibility
      );
    });
}

export async function getAdminDogDetail(
  dogId: string,
  visibility: AdminVisibilityMode = 'full'
): Promise<AdminDogDetail | null> {
  const dogRes = await supabaseAdmin.from('dogs').select(DOG_SELECT).eq('id', dogId).maybeSingle();
  const dog = (dogRes.data as Dog | null) ?? null;

  if (!dog) return null;

  const [ownerRes, staffRole, bookingDogsRes, slotRes] = await Promise.all([
    supabaseAdmin.from('profiles').select(PROFILE_SELECT).eq('user_id', dog.owner_id).maybeSingle(),
    getStaffRoleForUserInternal(dog.owner_id),
    supabaseAdmin
      .from('booking_dogs')
      .select(
        'dog_id, bookings!inner(id, user_id, service_type, start_date, end_date, arrival_time, departure_time, status, notes, total_price, taxi_option, taxi_distance_band, taxi_price, taxi_pickup_time, taxi_return_time, booking_dogs(id, booking_id, dog_id, accommodation_type, accommodation_price_per_day, days_count, accommodation_subtotal, extras, extras_subtotal, per_dog_total, dogs(id, name, breed, grooming_difficulty)))'
      )
      .eq('dog_id', dogId),
    fetchServiceSlotBookingsForUsers([dog.owner_id]),
  ]);

  const owner = (ownerRes.data as Profile | null) ?? null;
  const profileMap = new Map<string, Profile | ProfileSummaryRow>();
  if (owner) {
    profileMap.set(
      dog.owner_id,
      visibility === 'full' ? owner : (sanitizeProfileSummaryForViewer(owner) as Profile)
    );
  }

  const bookingRows = ((bookingDogsRes.data ?? []) as Array<{ bookings?: PensioneBookingQueryRow | PensioneBookingQueryRow[] | null }>)
    .map((row) => firstRelation(row.bookings))
    .filter(Boolean) as PensioneBookingQueryRow[];

  const slotRows = (slotRes as ServiceSlotBookingQueryRow[]).filter((row) => slotBookingDogIds(row).includes(dogId));
  const dogMap = new Map<string, Dog>([[dog.id, dog]]);

  const combined = [
    ...buildPensioneAgendaItems({ rows: bookingRows, profileMap }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
  ];
  const { activeTimeline, historyTimeline } = splitAgendaItems(combined);

  return {
    dog,
    owner: visibility === 'full' ? owner : sanitizeProfileForViewer(owner),
    ownerStaffRole: visibility === 'full' ? staffRole : null,
    activeTimeline,
    historyTimeline,
  };
}

export async function getAdminBookingDetail(
  kind: AdminBookingKind,
  bookingId: string,
  visibility: AdminVisibilityMode = 'full'
): Promise<AdminBookingDetail | null> {
  if (kind === 'PENSIONE') {
    const bookingRes = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, service_type, start_date, end_date, arrival_time, departure_time, status, notes, total_price, taxi_option, taxi_distance_band, taxi_price, taxi_pickup_time, taxi_return_time, created_at, printed_at, booking_dogs(id, booking_id, dog_id, accommodation_type, accommodation_price_per_day, days_count, accommodation_subtotal, extras, extras_subtotal, per_dog_total, dogs(id, name, breed, grooming_difficulty))'
      )
      .eq('id', bookingId)
      .maybeSingle();

    const booking = (bookingRes.data as PensioneBookingQueryRow | null) ?? null;
    if (!booking) return null;

    const [profileRes, dogMap] = await Promise.all([
      supabaseAdmin.from('profiles').select(PROFILE_SELECT).eq('user_id', booking.user_id).maybeSingle(),
      loadDogsByIds(unique((booking.booking_dogs ?? []).map((row) => row.dog_id))),
    ]);

    const profile = (profileRes.data as Profile | null) ?? null;
    const extrasList = (booking.booking_dogs ?? []).map((row) => row.extras ?? null);
    const extraLabels = bookingExtraLabels(extrasList);
    const taxiEnabled = Boolean(booking.taxi_option && booking.taxi_option !== 'NONE');
    const canShowContact = visibility === 'full' || taxiEnabled;
    const status = deriveAgendaStatus(
      booking.status ?? null,
      completionCutoffEndOfDay(booking.end_date ?? booking.start_date)
    );
    const meta = [formatDogCountLabel(booking.booking_dogs?.length ?? 0)];
    meta.push(...extraLabels);
    if (taxiEnabled) meta.push('Taxi dog');

    return {
      kind,
      id: booking.id,
      status,
      serviceKey: 'PENSIONE',
      serviceType: booking.service_type === 'TARGHETTA' ? null : booking.service_type,
      serviceVariant: null,
      serviceLabel: 'Pensione',
      startAt: buildDateTime(booking.start_date, booking.arrival_time ?? null),
      endAt: booking.end_date ? buildDateTime(booking.end_date, booking.departure_time ?? null, true) : null,
      totalPrice: booking.total_price ?? null,
      notes: booking.notes ?? null,
      meta,
      printedAt: (booking as { printed_at?: string | null }).printed_at ?? null,
      booking: {
        createdAt: booking.created_at ?? null,
        arrivalTime: booking.arrival_time ?? null,
        departureTime: booking.departure_time ?? null,
        taxiPickupTime: booking.taxi_pickup_time ?? null,
        taxiReturnTime: booking.taxi_return_time ?? null,
        taxiDistanceBand: booking.taxi_distance_band ?? null,
      },
      user: {
        userId: booking.user_id,
        fullName: formatPersonName(
          profile?.first_name ?? null,
          profile?.last_name ?? null,
          visibility === 'full' ? profile?.email ?? null : null
        ),
        email: visibility === 'full' ? profile?.email ?? null : null,
        phone: canShowContact ? profile?.phone ?? null : null,
        dogAddressLine: canShowContact ? profile?.dog_address_line ?? null : null,
        dogCity: canShowContact ? profile?.dog_city ?? null : null,
        dogZipCode: canShowContact ? profile?.dog_zip_code ?? null : null,
        dogProvince: canShowContact ? profile?.dog_province ?? null : null,
        profile: visibility === 'full' ? profile : null,
      },
      dogs: unique((booking.booking_dogs ?? []).map((row) => row.dog_id))
        .map((dogId) => {
          const dog = dogMap.get(dogId);
          const bookingDog = (booking.booking_dogs ?? []).find((row) => row.dog_id === dogId);
          if (!dog) return null;

          return {
            dogId: dog.id,
            name: dog.name,
            breed: dog.breed ?? null,
            microchip: dog.microchip ?? null,
            sizeCategory: dog.size_category ?? null,
            groomingDifficulty: dog.grooming_difficulty ?? null,
            sex: dog.sex ?? null,
            birthDate: dog.birth_date ?? null,
            notes: dog.notes ?? null,
            coatColor: dog.coat_color ?? null,
            temperament: dog.temperament ?? null,
            extras: bookingDog?.extras ?? null,
            pricing: {
              accommodationType: bookingDog?.accommodation_type ?? null,
              accommodationPricePerDay: bookingDog?.accommodation_price_per_day ?? null,
              daysCount: bookingDog?.days_count ?? null,
              accommodationSubtotal: bookingDog?.accommodation_subtotal ?? null,
              extrasSubtotal: bookingDog?.extras_subtotal ?? null,
              total: bookingDog?.per_dog_total ?? null,
            },
          };
        })
        .filter(Boolean) as AdminBookingDetail['dogs'],
      taxi: {
        enabled: taxiEnabled,
        option: (booking.taxi_option as TaxiOption | null) ?? null,
        distanceKm: null,
        priceEur: booking.taxi_price ?? null,
      },
      credits: {
        passId: null,
        creditsSpent: null,
      },
    };
  }

  const bookingRes = await supabaseAdmin
    .from('service_slot_bookings')
    .select(
      'id, user_id, service_type, service_variant, slot_id, dog_id, dog_ids, taxi_enabled, taxi_distance_km, taxi_price_eur, total_price, pass_id, credits_spent, status, notes, created_at, service_slots(id, start_at, end_at, capacity, service_type, service_variant)'
    )
    .eq('id', bookingId)
    .maybeSingle();

  const booking = (bookingRes.data as ServiceSlotBookingQueryRow | null) ?? null;
  if (!booking) return null;

  const [profileRes, dogMap] = await Promise.all([
    supabaseAdmin.from('profiles').select(PROFILE_SELECT).eq('user_id', booking.user_id).maybeSingle(),
    loadDogsByIds(slotBookingDogIds(booking)),
  ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const slot = firstRelation(booking.service_slots);
  const taxiEnabled = Boolean(booking.taxi_enabled);
  const canShowContact = visibility === 'full' || taxiEnabled;
  const status = deriveAgendaStatus(
    booking.status ?? null,
    completionCutoffEndOfDay(slot?.end_at ?? slot?.start_at ?? null)
  );
  const serviceType = booking.service_type ?? slot?.service_type ?? null;
  const serviceVariant = booking.service_variant ?? slot?.service_variant ?? null;
  const serviceKey = (serviceType ?? 'CONSULENZA') as AdminServiceKey;
  const dogIds = slotBookingDogIds(booking);
  const meta = [formatDogCountLabel(dogIds.length)];
  if (taxiEnabled) meta.push('Taxi dog');
  if (booking.credits_spent && booking.credits_spent > 0) {
    meta.push(`${booking.credits_spent} ${booking.credits_spent === 1 ? 'credito' : 'crediti'}`);
  }

  return {
    kind,
    id: booking.id,
    status,
    serviceKey,
    serviceType,
    serviceVariant,
    serviceLabel: getAdminServiceLabel(serviceKey, serviceType, serviceVariant),
    startAt: slot?.start_at ?? booking.created_at,
    endAt: slot?.end_at ?? null,
    totalPrice: booking.total_price ?? null,
    notes: booking.notes ?? null,
    meta,
    printedAt: null,
    booking: {
      createdAt: booking.created_at ?? null,
      arrivalTime: null,
      departureTime: null,
      taxiPickupTime: null,
      taxiReturnTime: null,
      taxiDistanceBand: null,
    },
    user: {
      userId: booking.user_id,
      fullName: formatPersonName(
        profile?.first_name ?? null,
        profile?.last_name ?? null,
        visibility === 'full' ? profile?.email ?? null : null
      ),
      email: visibility === 'full' ? profile?.email ?? null : null,
      phone: canShowContact ? profile?.phone ?? null : null,
      dogAddressLine: canShowContact ? profile?.dog_address_line ?? null : null,
      dogCity: canShowContact ? profile?.dog_city ?? null : null,
      dogZipCode: canShowContact ? profile?.dog_zip_code ?? null : null,
      dogProvince: canShowContact ? profile?.dog_province ?? null : null,
      profile: visibility === 'full' ? profile : null,
    },
    dogs: dogIds
      .map((dogId) => {
        const dog = dogMap.get(dogId);
        if (!dog) return null;

        return {
          dogId: dog.id,
          name: dog.name,
          breed: dog.breed ?? null,
          microchip: dog.microchip ?? null,
          sizeCategory: dog.size_category ?? null,
          groomingDifficulty: dog.grooming_difficulty ?? null,
          sex: dog.sex ?? null,
          birthDate: dog.birth_date ?? null,
          notes: dog.notes ?? null,
          coatColor: dog.coat_color ?? null,
          temperament: dog.temperament ?? null,
          extras: null,
          pricing: {
            accommodationType: null,
            accommodationPricePerDay: null,
            daysCount: null,
            accommodationSubtotal: null,
            extrasSubtotal: null,
            total: null,
          },
        };
      })
      .filter(Boolean) as AdminBookingDetail['dogs'],
    taxi: {
      enabled: taxiEnabled,
      option: null,
      distanceKm: booking.taxi_distance_km ?? null,
      priceEur: booking.taxi_price_eur ?? null,
    },
    credits: {
      passId: booking.pass_id ?? null,
      creditsSpent: booking.credits_spent ?? null,
    },
  };
}

export async function getAdminDateView(args: {
  startDate: string;
  endDate: string;
  status?: string | null;
  visibility?: AdminVisibilityMode;
}): Promise<AdminDateViewResponse> {
  const { startDate, endDate, status = null, visibility = 'full' } = args;
  const { profileMap: rawProfileMap, dogMap, pensioneRows, slotRows } = await fetchAgendaDataByRange({ startDate, endDate });
  const profileMap = sanitizeProfileMapForVisibility(rawProfileMap, visibility);

  const items = filterAgendaByStatus([
    ...buildPensioneAgendaItems({ rows: pensioneRows, profileMap }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
  ], status).sort(compareAscByStart);

  const slots = await listAdminSlots({ startDate, endDate, serviceTypes: 'ALL' });
  return { items, slots };
}

export async function getAdminServiceView(args: {
  startDate: string;
  endDate: string;
  serviceKeys: AdminServiceKey[];
  status?: string | null;
  visibility?: AdminVisibilityMode;
}): Promise<AdminServicesViewResponse> {
  const { startDate, endDate, serviceKeys, status = null, visibility = 'full' } = args;
  const { profileMap: rawProfileMap, dogMap, pensioneRows, slotRows } = await fetchAgendaDataByRange({ startDate, endDate });
  const profileMap = sanitizeProfileMapForVisibility(rawProfileMap, visibility);
  const allServiceKeysSelected =
    new Set(serviceKeys).size >= ADMIN_SERVICE_OPTIONS.length;

  const items = filterAgendaByStatus(
    allServiceKeysSelected
      ? [
          ...buildPensioneAgendaItems({ rows: pensioneRows, profileMap }),
          ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
        ]
      : serviceKeys.flatMap((serviceKey) => [
          ...buildPensioneAgendaItems({
            rows: pensioneRows,
            profileMap,
            filterKey: serviceKey,
            startDate,
            endDate,
          }),
          ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap, filterKey: serviceKey }),
        ]),
    status
  ).sort(compareAscByStart);

  const slots = await listAdminSlots({
    startDate,
    endDate,
    serviceTypes: slotServiceTypesFromKeys(serviceKeys),
  });

  return { items, slots };
}

export async function getAdminOverview(
  visibility: AdminVisibilityMode = 'full'
): Promise<AdminOverview> {
  const now = new Date();
  const startDate = now.toISOString().slice(0, 10);
  const endDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10);
  const urgentEndDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10);

  const [usersRes, dogsRes, pendingDocsRes, agendaData] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id', { head: true, count: 'exact' }).is('deleted_at', null),
    supabaseAdmin.from('dogs').select('id', { head: true, count: 'exact' }).neq('is_active', false),
    supabaseAdmin
      .from('user_documents')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'PENDING'),
    fetchAgendaDataByRange({ startDate, endDate }),
  ]);

  const profileMap = sanitizeProfileMapForVisibility(agendaData.profileMap, visibility);

  const agendaItems = [
    ...buildPensioneAgendaItems({
      rows: agendaData.pensioneRows,
      profileMap,
    }),
    ...buildServiceSlotAgendaItems({
      rows: agendaData.slotRows,
      profileMap,
      dogMap: agendaData.dogMap,
    }),
  ].sort(compareAscByStart);

  const activeAgendaItems = agendaItems.filter((item) => item.isActive);
  const pendingAgendaItems = agendaItems.filter((item) => item.status === 'PENDING');
  const activePensioneRows = (agendaData.pensioneRows as PensioneBookingQueryRow[]).filter((row) =>
    isActiveBookingStatus(
      deriveAgendaStatus(
        row.status ?? null,
        completionCutoffEndOfDay(row.end_date ?? row.start_date)
      )
    )
  );
  const activePensioneToday = activePensioneRows.filter((row) => {
    const bookingEnd = row.end_date ?? row.start_date;
    return row.start_date <= startDate && bookingEnd >= startDate;
  });
  const presentDogIds = unique(
    activePensioneToday.flatMap((row) => (row.booking_dogs ?? []).map((bookingDog) => bookingDog.dog_id))
  );
  const todayServiceKeys = ADMIN_SERVICE_OPTIONS
    .filter((option) => option.key !== 'PENSIONE')
    .map((option) => option.key);
  const todayServices = uniqueAgendaItems(
    todayServiceKeys.flatMap((serviceKey) => [
      ...buildPensioneAgendaItems({
        rows: agendaData.pensioneRows,
        profileMap,
        filterKey: serviceKey,
        startDate,
        endDate: startDate,
      }),
      ...filterAgendaItemsByDateRange(
        buildServiceSlotAgendaItems({
          rows: agendaData.slotRows,
          profileMap,
          dogMap: agendaData.dogMap,
          filterKey: serviceKey,
        }),
        startDate,
        startDate
      ),
    ])
  )
    .filter((item) => item.isActive)
    .sort(compareAscByStart);
  const serviceCountsToday = ADMIN_SERVICE_OPTIONS
    .filter((option) => option.key !== 'PENSIONE')
    .map((option) => ({
      serviceKey: option.key,
      label: option.label,
      count: todayServices.filter((item) => item.serviceKey === option.key).length,
    }))
    .filter((entry) => entry.count > 0);
  const urgentItems = uniqueAgendaItems([
    ...todayServices,
    ...filterAgendaItemsByDateRange(activeAgendaItems, startDate, urgentEndDate),
  ])
    .sort((left, right) => compareAgendaUrgency(left, right, startDate))
    .slice(0, 12);

  const pendingDocumentsRaw = await supabaseAdmin
    .from('user_documents')
    .select('id, user_id, kind, path, created_at, status, accepted_at, rejected_at, staff_note')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(8);

  const pendingDocumentUserIds = unique(
    ((pendingDocumentsRaw.data ?? []) as UserDocumentRow[]).map((row) => row.user_id)
  );
  const pendingDocumentProfiles = await loadProfilesByIds(pendingDocumentUserIds);

  const pendingDocuments =
    visibility === 'full'
      ? await Promise.all(
          ((pendingDocumentsRaw.data ?? []) as UserDocumentRow[]).map(async (row) =>
            mapDocumentRow(
              row,
              await createSignedUrl(row.path),
              formatDocumentOwnerName(pendingDocumentProfiles.get(row.user_id))
            )
          )
        )
      : [];

  const activeBookings = activeAgendaItems.length;
  const pendingBookings = pendingAgendaItems.length;

  return {
    totals: {
      users: usersRes.count ?? 0,
      dogs: dogsRes.count ?? 0,
      activeBookings,
      pendingBookings,
      pendingDocuments: visibility === 'full' ? pendingDocsRes.count ?? 0 : 0,
      presentDogs: presentDogIds.length,
      activePensione: activePensioneToday.length,
      checkInsToday: activePensioneRows.filter((row) => row.start_date === startDate).length,
      checkOutsToday: activePensioneRows.filter((row) => (row.end_date ?? row.start_date) === startDate).length,
      servicesToday: todayServices.length,
    },
    serviceCountsToday,
    todayServices: todayServices.slice(0, 12),
    pendingBookings: pendingAgendaItems.slice(0, 8),
    pendingDocuments,
    urgentItems,
  };
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;

  const [usersRes, dogsRes, bookingsRes, slotBookingsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id', { head: true, count: 'exact' }).is('deleted_at', null),
    supabaseAdmin.from('dogs').select('id', { head: true, count: 'exact' }).neq('is_active', false),
    supabaseAdmin
      .from('bookings')
      .select('user_id, service_type, total_price, status, created_at, booking_dogs(dog_id)'),
    supabaseAdmin
      .from('service_slot_bookings')
      .select('user_id, service_type, total_price, status, created_at, dog_id, dog_ids'),
  ]);

  const bookingRows = (bookingsRes.data ?? []) as Array<{
    user_id: string;
    service_type: BookingRow['service_type'] | null;
    total_price: number | null;
    status: BookingStatus | null;
    created_at?: string | null;
    booking_dogs?: Array<{ dog_id: string }> | null;
  }>;
  const slotRows = (slotBookingsRes.data ?? []) as Array<Pick<
    ServiceSlotBookingQueryRow,
    'user_id' | 'service_type' | 'total_price' | 'status' | 'created_at' | 'dog_id' | 'dog_ids'
  >>;

  const activeUsers = new Set<string>();
  const activeDogs = new Set<string>();
  const revenueByService = new Map<AnalyticsServiceKey, { revenue: number; bookings: number }>(
    ANALYTICS_SERVICE_KEYS.map((serviceKey) => [serviceKey, { revenue: 0, bookings: 0 }])
  );

  let confirmedRevenue = 0;
  let confirmedBookings = 0;
  let last30DaysRevenue = 0;
  let last30DaysBookings = 0;

  for (const row of bookingRows) {
    if (row.status && row.status !== 'CANCELLED') {
      activeUsers.add(row.user_id);
      for (const bookingDog of row.booking_dogs ?? []) {
        if (bookingDog.dog_id) activeDogs.add(bookingDog.dog_id);
      }
    }

    if (!row.service_type || !ANALYTICS_SERVICE_KEYS.includes(row.service_type as AnalyticsServiceKey)) continue;
    if (!isConfirmedRevenueStatus(row.status)) continue;

    const serviceKey = row.service_type as AnalyticsServiceKey;
    const amount = row.total_price ?? 0;
    const bucket = revenueByService.get(serviceKey);
    if (bucket) {
      bucket.revenue += amount;
      bucket.bookings += 1;
    }
    confirmedRevenue += amount;
    confirmedBookings += 1;

    const createdAt = Date.parse(String(row.created_at ?? ''));
    if (!Number.isNaN(createdAt) && createdAt >= thirtyDaysAgo) {
      last30DaysRevenue += amount;
      last30DaysBookings += 1;
    }
  }

  for (const row of slotRows) {
    if (row.status && row.status !== 'CANCELLED') {
      activeUsers.add(row.user_id);
      for (const dogId of slotBookingDogIds(row)) {
        activeDogs.add(dogId);
      }
    }

    if (!row.service_type || !ANALYTICS_SERVICE_KEYS.includes(row.service_type as AnalyticsServiceKey)) continue;
    if (!isConfirmedRevenueStatus(row.status)) continue;

    const serviceKey = row.service_type as AnalyticsServiceKey;
    const amount = row.total_price ?? 0;
    const bucket = revenueByService.get(serviceKey);
    if (bucket) {
      bucket.revenue += amount;
      bucket.bookings += 1;
    }
    confirmedRevenue += amount;
    confirmedBookings += 1;

    const createdAt = Date.parse(String(row.created_at ?? ''));
    if (!Number.isNaN(createdAt) && createdAt >= thirtyDaysAgo) {
      last30DaysRevenue += amount;
      last30DaysBookings += 1;
    }
  }

  return {
    totals: {
      users: usersRes.count ?? 0,
      activeUsers: activeUsers.size,
      dogs: dogsRes.count ?? 0,
      activeDogs: activeDogs.size,
      confirmedRevenue,
      confirmedBookings,
      last30DaysRevenue,
      last30DaysBookings,
    },
    revenueByService: ANALYTICS_SERVICE_KEYS.map((serviceKey) => {
      const bucket = revenueByService.get(serviceKey) ?? { revenue: 0, bookings: 0 };
      return {
        serviceKey,
        label: getAdminServiceLabel(serviceKey, serviceKey, null),
        revenue: bucket.revenue,
        bookings: bucket.bookings,
      };
    }),
  };
}

export async function listAdminSlots(args: {
  startDate: string;
  endDate: string;
  serviceTypes: ServiceType[] | 'ALL';
}): Promise<AdminSlotRecord[]> {
  const { startDate, endDate, serviceTypes } = args;

  let slotQuery = supabaseAdmin
    .from('service_slots')
    .select('id, service_type, service_variant, start_at, end_at, capacity, notes, created_at')
    .eq('is_active', true)
    .gte('start_at', `${startDate}T00:00:00`)
    .lte('start_at', `${endDate}T23:59:59`)
    .order('start_at', { ascending: true });

  if (serviceTypes !== 'ALL') {
    if (serviceTypes.length === 0) return [];
    slotQuery = slotQuery.in('service_type', serviceTypes);
  }

  const slotsRes = await slotQuery;
  const slots = (slotsRes.data ?? []) as ServiceSlotRow[];

  if (slots.length === 0) {
    return [];
  }

  const bookingCountsRes = await supabaseAdmin
    .from('service_slot_bookings')
    .select('slot_id, status')
    .in('slot_id', slots.map((slot) => slot.id))
    .in('status', ['CONFIRMED', 'PAID']);

  const bookedCounts = new Map<string, number>();
  for (const row of (bookingCountsRes.data ?? []) as Array<{ slot_id: string }>) {
    bookedCounts.set(row.slot_id, (bookedCounts.get(row.slot_id) ?? 0) + 1);
  }

  return slots.map((slot) => {
    const bookedCount = bookedCounts.get(slot.id) ?? 0;
    return {
      id: slot.id,
      serviceType: slot.service_type,
      serviceVariant: slot.service_variant ?? null,
      startAt: slot.start_at,
      endAt: slot.end_at,
      capacity: slot.capacity,
      bookedCount,
      remainingCount: Math.max(slot.capacity - bookedCount, 0),
      notes: slot.notes ?? null,
    } satisfies AdminSlotRecord;
  });
}

export async function updateAdminUserProfile(userId: string, payload: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert({ ...payload, user_id: userId }, { onConflict: 'user_id' })
    .select(PROFILE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare il profilo utente.');
  }

  return data as Profile;
}

export async function unlockAdminServicePass(args: {
  userId: string;
  passId: string;
  staffUserId: string;
}): Promise<ServicePassRow> {
  const { userId, passId, staffUserId } = args;

  const { data: existingPass, error: existingPassError } = await supabaseAdmin
    .from('service_passes')
    .select('id, user_id, status')
    .eq('id', passId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingPassError) {
    throw new Error(existingPassError.message);
  }

  if (!existingPass) {
    throw new Error('Pacchetto crediti non trovato.');
  }

  if (existingPass.status !== 'LOCKED') {
    throw new Error('Questo pacchetto non richiede sblocco.');
  }

  const { data, error } = await supabaseAdmin
    .from('service_passes')
    .update({
      status: 'ACTIVE',
      unlocked_at: new Date().toISOString(),
      unlocked_by: staffUserId,
    })
    .eq('id', passId)
    .eq('user_id', userId)
    .eq('status', 'LOCKED')
    .select('id, user_id, service_type, service_variant, product_id, credits_total, credits_used, status, purchased_at, expires_at, unlocked_at, unlocked_by')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile sbloccare il pacchetto crediti.');
  }

  return data as ServicePassRow;
}

/**
 * Conferma pagamento: registra l'importo incassato, azzera il saldo dell'utente e
 * sblocca i pacchetti in attesa. Tutto atomico nella RPC settle_user_wallet.
 */
export async function settleAdminUserWallet(args: {
  userId: string;
  amountEur: number;
  staffUserId: string;
}): Promise<{ amountEur: number; balanceBefore: number; paidAt: string }> {
  const { userId, amountEur, staffUserId } = args;

  const normalizedAmount = Number(amountEur);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    throw new Error('Importo non valido.');
  }

  const { data, error } = await supabaseAdmin.rpc('settle_user_wallet', {
    p_user_id: userId,
    p_amount_eur: normalizedAmount,
    p_staff_id: staffUserId,
  });

  if (error) {
    throw new Error(error.message ?? 'Impossibile registrare il pagamento.');
  }

  const row = (data ?? null) as
    | { amount_eur?: number | null; balance_before?: number | null; paid_at?: string | null }
    | null;

  return {
    amountEur: Number(row?.amount_eur ?? normalizedAmount),
    balanceBefore: Number(row?.balance_before ?? 0),
    paidAt: String(row?.paid_at ?? new Date().toISOString()),
  };
}

export async function updateAdminDog(dogId: string, input: DogInput): Promise<Dog> {
  const { data, error } = await supabaseAdmin
    .from('dogs')
    .update({
      species: input.species,
      species_other: input.species_other,
      libretto_name: input.libretto_name,
      name: input.name.trim(),
      breed: input.breed,
      size_category: input.size_category,
      grooming_difficulty: input.grooming_difficulty,
      sex: input.sex,
      microchip: input.microchip,
      birth_date: input.birth_date,
      notes: input.notes,
      coat_color: input.coat_color,
      temperament: input.temperament,
      weight_kg: input.weight_kg,
      origin_breeds: input.origin_breeds,
      show_breed: input.show_breed,
      show_sex: input.show_sex,
      show_size: input.show_size,
      show_microchip: input.show_microchip,
      show_birth_date: input.show_birth_date,
      show_notes: input.show_notes,
      show_coat_color: input.show_coat_color,
      show_temperament: input.show_temperament,
      show_weight: input.show_weight,
      show_origin_breeds: input.show_origin_breeds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dogId)
    .select(DOG_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare il cane.');
  }

  return data as Dog;
}

/** Lista dei clienti soft-deleted (per la pagina "Utenti eliminati" del gestionale). */
export async function listDeletedAdminUsers(limit = 100): Promise<AdminUserListItem[]> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SELECT)
    .not('deleted_at', 'is', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(limit);

  const profiles = (data ?? []) as Profile[];
  const userIds = profiles.map((profile) => profile.user_id);
  const [dogs, staffRoles] = await Promise.all([
    loadDogsByOwnerIds(userIds),
    loadStaffRoleMap(userIds),
  ]);

  const dogsByOwner = new Map<string, DogSummaryRow[]>();
  for (const dog of dogs) {
    const rows = dogsByOwner.get(dog.owner_id) ?? [];
    rows.push(dog);
    dogsByOwner.set(dog.owner_id, rows);
  }

  return profiles.map((profile) => {
    const ownerDogs = dogsByOwner.get(profile.user_id) ?? [];
    return {
      userId: profile.user_id,
      fullName: formatPersonName(profile.first_name ?? null, profile.last_name ?? null, profile.email ?? null),
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      city: profile.city ?? null,
      dogsCount: ownerDogs.length,
      activeBookings: 0,
      pendingDocuments: 0,
      dogNames: ownerDogs.map((dog) => dog.name).filter(Boolean) as string[],
      staffRole: staffRoles.get(profile.user_id) ?? null,
      walletDue: Number((profile as { wallet_due_eur?: number | null }).wallet_due_eur ?? 0),
    } satisfies AdminUserListItem;
  });
}

export async function updateAdminDocumentStatus(args: {
  documentId: string;
  status: 'ACCEPTED' | 'REJECTED';
  staffNote?: string | null;
}): Promise<{
  userId: string;
  kind: 'ID_DOCUMENT' | 'WAIVER_SIGNED';
  previousStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  status: 'ACCEPTED' | 'REJECTED';
}> {
  const { documentId, status, staffNote = null } = args;
  const now = new Date().toISOString();
  const { data: current, error: currentError } = await supabaseAdmin
    .from('user_documents')
    .select('user_id, kind, status')
    .eq('id', documentId)
    .single();

  if (currentError || !current) {
    throw new Error(currentError?.message ?? 'Documento non trovato.');
  }

  const patch =
    status === 'ACCEPTED'
      ? { status, accepted_at: now, rejected_at: null, staff_note: staffNote }
      : { status, accepted_at: null, rejected_at: now, staff_note: staffNote };

  const { error } = await supabaseAdmin
    .from('user_documents')
    .update(patch)
    .eq('id', documentId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    userId: String(current.user_id),
    kind: current.kind as 'ID_DOCUMENT' | 'WAIVER_SIGNED',
    previousStatus: current.status as 'PENDING' | 'ACCEPTED' | 'REJECTED',
    status,
  };
}

/**
 * "Richiedi di nuovo": segna il documento come da rivedere e — se è il documento
 * d'identità registrato sul profilo — azzera id_document_path così la prenotazione
 * viene bloccata finché il cliente non ne carica uno nuovo.
 */
export async function requestAdminDocumentReupload(documentId: string): Promise<{
  userId: string;
  kind: 'ID_DOCUMENT' | 'WAIVER_SIGNED';
  previousStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}> {
  const now = new Date().toISOString();
  const { data: current, error: currentError } = await supabaseAdmin
    .from('user_documents')
    .select('user_id, kind, status, path')
    .eq('id', documentId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error('Documento non trovato.');

  const userId = String(current.user_id);
  const kind = current.kind as 'ID_DOCUMENT' | 'WAIVER_SIGNED';
  const path = String((current as { path?: string | null }).path ?? '').trim();

  const { error } = await supabaseAdmin
    .from('user_documents')
    .update({ status: 'REJECTED', accepted_at: null, rejected_at: now })
    .eq('id', documentId);
  if (error) throw new Error(error.message);

  if (kind === 'ID_DOCUMENT') {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id_document_path')
      .eq('user_id', userId)
      .maybeSingle();
    if (profile && String((profile as { id_document_path?: string | null }).id_document_path ?? '') === path) {
      await supabaseAdmin
        .from('profiles')
        .update({ id_document_path: null, id_document_uploaded_at: null })
        .eq('user_id', userId);
    }
  }

  return { userId, kind, previousStatus: current.status as 'PENDING' | 'ACCEPTED' | 'REJECTED' };
}

/**
 * "Modifica": lo staff carica direttamente un nuovo file per il documento.
 * Sostituisce il file, marca il documento come ACCETTATO e — se è il documento
 * d'identità — aggiorna id_document_path sul profilo. Rimuove il vecchio file.
 */
export async function replaceAdminDocumentFile(args: {
  documentId: string;
  newPath: string;
}): Promise<{ userId: string; kind: 'ID_DOCUMENT' | 'WAIVER_SIGNED' }> {
  const { documentId, newPath } = args;
  const now = new Date().toISOString();

  const { data: current, error: currentError } = await supabaseAdmin
    .from('user_documents')
    .select('user_id, kind, path')
    .eq('id', documentId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error('Documento non trovato.');

  const userId = String(current.user_id);
  const kind = current.kind as 'ID_DOCUMENT' | 'WAIVER_SIGNED';
  const oldPath = String((current as { path?: string | null }).path ?? '').trim();

  const { error } = await supabaseAdmin
    .from('user_documents')
    .update({ path: newPath, status: 'ACCEPTED', accepted_at: now, rejected_at: null })
    .eq('id', documentId);
  if (error) throw new Error(error.message);

  if (kind === 'ID_DOCUMENT') {
    await supabaseAdmin
      .from('profiles')
      .update({ id_document_path: newPath, id_document_uploaded_at: now })
      .eq('user_id', userId);
  }

  if (oldPath && oldPath !== newPath) {
    await supabaseAdmin.storage.from(IDENTITY_BUCKET).remove([oldPath]).catch(() => undefined);
  }

  return { userId, kind };
}

export async function updateAdminBookingStatus(args: {
  kind: AdminBookingKind;
  bookingId: string;
  status: BookingStatus | ServiceStatus;
}): Promise<{
  userId: string;
  serviceType: string;
  previousStatus: string | null;
  status: string;
  kind: AdminBookingKind;
}> {
  const { kind, bookingId, status } = args;
  const table = kind === 'PENSIONE' ? 'bookings' : 'service_slot_bookings';
  // Per la pensione il totale entra nel saldo solo quando la prenotazione è confermata:
  // ci serve total_price per aggiornare il wallet alla transizione di stato (presente
  // su entrambe le tabelle).
  const { data: current, error: currentError } = await supabaseAdmin
    .from(table)
    .select('user_id, service_type, status, total_price')
    .eq('id', bookingId)
    .single();

  if (currentError || !current) {
    throw new Error(currentError?.message ?? 'Prenotazione non trovata.');
  }

  const { error } = await supabaseAdmin
    .from(table)
    .update({ status })
    .eq('id', bookingId);

  if (error) {
    throw new Error(error.message);
  }

  // Pensione → saldo: addebita alla conferma, storna se esce dagli stati confermati.
  if (kind === 'PENSIONE') {
    const wasCharged = isOutstandingBalanceStatus(current.status as BookingStatus | null);
    const isCharged = isOutstandingBalanceStatus(status);
    const total = Number((current as { total_price?: number | null }).total_price ?? 0);
    if (Number.isFinite(total) && total > 0 && wasCharged !== isCharged) {
      const delta = isCharged ? total : -total;
      const { error: walletError } = await supabaseAdmin.rpc('add_wallet_due', {
        p_user_id: String(current.user_id),
        p_amount_eur: delta,
      });
      if (walletError) {
        throw new Error(walletError.message);
      }
    }
  }

  return {
    userId: String(current.user_id),
    serviceType: String(current.service_type ?? ''),
    previousStatus: current.status ? String(current.status) : null,
    status: String(status),
    kind,
  };
}

/**
 * Elimina definitivamente una prenotazione, stornando prima gli effetti economici:
 * - pensione: se era a saldo (CONFIRMED/COMPLETED) toglie il totale dal wallet.
 * - slot: rimborsa il credito al pass (riattivandolo se era CONSUMED) e toglie
 *   l'eventuale taxi dal wallet.
 */
export async function deleteAdminBooking(args: {
  kind: AdminBookingKind;
  bookingId: string;
}): Promise<{ userId: string }> {
  const { kind, bookingId } = args;

  if (kind === 'PENSIONE') {
    const { data: current, error: readError } = await supabaseAdmin
      .from('bookings')
      .select('user_id, status, total_price')
      .eq('id', bookingId)
      .single();
    if (readError || !current) throw new Error(readError?.message ?? 'Prenotazione non trovata.');

    if (isOutstandingBalanceStatus(current.status as BookingStatus | null)) {
      const total = Number((current as { total_price?: number | null }).total_price ?? 0);
      if (Number.isFinite(total) && total > 0) {
        await supabaseAdmin.rpc('add_wallet_due', {
          p_user_id: String(current.user_id),
          p_amount_eur: -total,
        });
      }
    }

    await supabaseAdmin.from('booking_dogs').delete().eq('booking_id', bookingId);
    const { error } = await supabaseAdmin.from('bookings').delete().eq('id', bookingId);
    if (error) throw new Error(error.message);
    return { userId: String(current.user_id) };
  }

  // SERVICE_SLOT
  const { data: current, error: readError } = await supabaseAdmin
    .from('service_slot_bookings')
    .select('user_id, status, pass_id, credits_spent, taxi_enabled, taxi_price_eur')
    .eq('id', bookingId)
    .single();
  if (readError || !current) throw new Error(readError?.message ?? 'Prenotazione non trovata.');

  const wasActive = current.status !== 'CANCELLED';
  const passId = (current as { pass_id?: string | null }).pass_id ?? null;
  const creditsSpent = Number((current as { credits_spent?: number | null }).credits_spent ?? 0);

  if (wasActive && passId && creditsSpent > 0) {
    const { data: pass } = await supabaseAdmin
      .from('service_passes')
      .select('credits_total, credits_used')
      .eq('id', passId)
      .single();
    if (pass) {
      const nextUsed = Math.max(0, Number(pass.credits_used ?? 0) - creditsSpent);
      const reactivated = nextUsed < Number(pass.credits_total ?? 0);
      await supabaseAdmin
        .from('service_passes')
        .update(reactivated ? { credits_used: nextUsed, status: 'ACTIVE' } : { credits_used: nextUsed })
        .eq('id', passId);
    }
  }

  if (wasActive && (current as { taxi_enabled?: boolean | null }).taxi_enabled) {
    const taxi = Number((current as { taxi_price_eur?: number | null }).taxi_price_eur ?? 0);
    if (Number.isFinite(taxi) && taxi > 0) {
      await supabaseAdmin.rpc('add_wallet_due', {
        p_user_id: String(current.user_id),
        p_amount_eur: -taxi,
      });
    }
  }

  const { error } = await supabaseAdmin.from('service_slot_bookings').delete().eq('id', bookingId);
  if (error) throw new Error(error.message);
  return { userId: String(current.user_id) };
}

// ── Stampa prenotazioni pensione ──────────────────────────────────────────────
export async function markPensioneBookingPrinted(bookingId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ printed_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('service_type', 'PENSIONE')
    .is('printed_at', null);
  if (error) throw new Error(error.message);
}

export async function markPensioneBookingsPrinted(bookingIds: string[]): Promise<void> {
  const ids = unique(bookingIds.filter(Boolean));
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ printed_at: new Date().toISOString() })
    .in('id', ids)
    .is('printed_at', null);
  if (error) throw new Error(error.message);
}

/** Prenotazioni pensione non ancora stampate (non annullate), per la stampa massiva. */
export async function getUnprintedPensioneBookingDetails(): Promise<AdminBookingDetail[]> {
  const { data } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('service_type', 'PENSIONE')
    .is('printed_at', null)
    .neq('status', 'CANCELLED')
    .order('start_date', { ascending: true });

  const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  const details = await Promise.all(ids.map((id) => getAdminBookingDetail('PENSIONE', id, 'full')));
  return details.filter((detail): detail is AdminBookingDetail => Boolean(detail));
}

export async function upsertAdminSlot(input: {
  slotId?: string | null;
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;
  startAt: string;
  endAt: string;
  capacity: number;
  notes?: string | null;
}): Promise<AdminSlotRecord> {
  const { slotId = null, serviceType, serviceVariant, startAt, endAt, capacity, notes = null } = input;

  const payload = {
    id: slotId ?? undefined,
    service_type: serviceType,
    service_variant: serviceVariant,
    start_at: startAt,
    end_at: endAt,
    capacity,
    is_active: true,
    notes,
  };

  const operation = slotId
    ? supabaseAdmin.from('service_slots').update(payload).eq('id', slotId)
    : supabaseAdmin.from('service_slots').insert(payload);

  const { data, error } = await operation
    .select('id, service_type, service_variant, start_at, end_at, capacity, notes, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare lo slot.');
  }

  return {
    id: data.id,
    serviceType: data.service_type,
    serviceVariant: data.service_variant ?? null,
    startAt: data.start_at,
    endAt: data.end_at,
    capacity: data.capacity,
    bookedCount: 0,
    remainingCount: data.capacity,
    notes: data.notes ?? null,
  };
}

export async function deleteAdminSlot(slotId: string): Promise<void> {
  const { count, error: bookingsError } = await supabaseAdmin
    .from('service_slot_bookings')
    .select('id', { head: true, count: 'exact' })
    .eq('slot_id', slotId);

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error('Non puoi eliminare uno slot che ha prenotazioni collegate.');
  }

  const { error } = await supabaseAdmin
    .from('service_slots')
    .delete()
    .eq('id', slotId);

  if (error) {
    throw new Error(error.message);
  }
}

async function getStaffRoleForUserInternal(userId: string): Promise<StaffRole | null> {
  const { data } = await supabaseAdmin
    .from('staff_accounts')
    .select('role, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || data.is_active === false) return null;
  return data.role as StaffRole;
}

async function resolveAuthEmails(userIds: string[]): Promise<Map<string, string | null>> {
  const ids = unique(userIds.filter(Boolean));
  const emailMap = new Map<string, string | null>();

  await Promise.all(
    ids.map(async (userId) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error) {
        emailMap.set(userId, null);
        return;
      }
      emailMap.set(userId, data.user?.email ?? null);
    })
  );

  return emailMap;
}

export async function listAdminStaffMembers(): Promise<AdminStaffMember[]> {
  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .select('user_id, role, created_at, updated_at')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as StaffAccountRow[];
  const emailMap = await resolveAuthEmails(rows.map((row) => row.user_id));
  const profileMap = await loadProfilesByIds(rows.map((row) => row.user_id));

  return rows.map((row) => ({
    userId: row.user_id,
    fullName: formatPersonName(
      profileMap.get(row.user_id)?.first_name ?? null,
      profileMap.get(row.user_id)?.last_name ?? null,
      emailMap.get(row.user_id) ?? null
    ),
    email: emailMap.get(row.user_id) ?? null,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function upsertAdminStaffMember(args: {
  userId: string;
  role: StaffRole;
}): Promise<AdminStaffMember> {
  const { userId, role } = args;
  const [profileMap, emailMap] = await Promise.all([
    loadProfilesByIds([userId]),
    resolveAuthEmails([userId]),
  ]);

  const email = emailMap.get(userId) ?? null;
  if (!email) {
    throw new Error('Nessun account trovato per questo utente.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .upsert(
      {
        user_id: userId,
        role,
        is_active: true,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, role, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare il membro staff.');
  }

  return {
    userId: data.user_id,
    fullName: formatPersonName(
      profileMap.get(userId)?.first_name ?? null,
      profileMap.get(userId)?.last_name ?? null,
      email
    ),
    email,
    role: data.role,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function setAdminUserStaffRole(args: {
  userId: string;
  role: StaffRole | null;
}): Promise<StaffRole | null> {
  const { userId, role } = args;

  if (!role) {
    const { error } = await supabaseAdmin.from('staff_accounts').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    return null;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .upsert(
      {
        user_id: userId,
        role,
        is_active: true,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('role')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile aggiornare il ruolo staff.');
  }

  return data.role as StaffRole;
}
