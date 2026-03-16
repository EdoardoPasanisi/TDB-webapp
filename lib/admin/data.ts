import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  AdminAgendaItem,
  AdminBookingKind,
  AdminDateViewResponse,
  AdminDocumentRecord,
  AdminDogDetail,
  AdminDogListItem,
  AdminOverview,
  AdminServiceKey,
  AdminSlotRecord,
  AdminStaffMember,
  AdminUserDetail,
  AdminUserListItem,
  StaffRole,
} from '@/lib/admin/types';
import {
  ADMIN_ACTIVE_STATUSES,
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
  BookingRow,
  BookingStatus,
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
  'user_id, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';
const DOG_SELECT =
  'id, owner_id, created_at, updated_at, name, breed, size_category, grooming_difficulty, sex, microchip, birth_date, notes, coat_color, temperament, photo_path, is_active, public_id, show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes, show_coat_color, show_temperament';
const IDENTITY_BUCKET = 'identity-documents';

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

type DogJoin = { id: string; name: string | null; breed: string | null } | Array<{ id: string; name: string | null; breed: string | null }> | null;

type BookingDogQueryRow = {
  id: string;
  booking_id: string;
  dog_id: string;
  extras: BookingDogExtras | null;
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
  dog_ids: string[] | null;
  taxi_enabled: boolean;
  taxi_distance_km: number | null;
  taxi_price_eur: number | null;
  total_price: number | null;
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

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function compareAscByStart(a: AdminAgendaItem, b: AdminAgendaItem): number {
  return a.startAt.localeCompare(b.startAt);
}

function compareDescByStart(a: AdminAgendaItem, b: AdminAgendaItem): number {
  return b.startAt.localeCompare(a.startAt);
}

function buildDateTime(date: string, time?: string | null, endOfDay = false): string {
  if (!date) return '';
  if (time) return `${date}T${time}:00`;
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function bookingExtraLabels(extrasList: Array<BookingDogExtras | null | undefined>): string[] {
  const labels = new Set<string>();

  for (const extras of extrasList) {
    if (!extras) continue;
    if (extras.grooming) labels.add('Toelettatura');
    if (extras.vaccine) labels.add('Vaccinazione');
    if ((extras.trackingSessions ?? 0) > 0) labels.add(`Tracking x${extras.trackingSessions}`);
    if ((extras.fitnessSessions ?? 0) > 0) labels.add(`Fitness x${extras.fitnessSessions}`);
    if ((extras.walkSessions ?? 0) > 0) labels.add(`Passeggiate x${extras.walkSessions}`);
    if (extras.therapyActive) labels.add('Terapia');
  }

  return Array.from(labels);
}

function mapDocumentRow(row: UserDocumentRow, signedUrl: string | null): AdminDocumentRecord {
  return {
    id: row.id,
    userId: row.user_id,
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

  const [pensioneRes, slotRes] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('user_id, status')
      .in('user_id', ids)
      .in('status', ADMIN_ACTIVE_STATUSES),
    supabaseAdmin
      .from('service_slot_bookings')
      .select('user_id, status')
      .in('user_id', ids)
      .in('status', ADMIN_ACTIVE_STATUSES),
  ]);

  for (const row of (pensioneRes.data ?? []) as Array<{ user_id: string }>) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }

  for (const row of (slotRes.data ?? []) as Array<{ user_id: string }>) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }

  return counts;
}

async function loadActiveBookingCountsForDogs(dogIds: string[]): Promise<Map<string, number>> {
  const ids = unique(dogIds.filter(Boolean));
  const counts = new Map<string, number>();

  if (ids.length === 0) return counts;

  const [bookingDogsRes, slotBookingsRes] = await Promise.all([
    supabaseAdmin
      .from('booking_dogs')
      .select('dog_id, bookings!inner(status)')
      .in('dog_id', ids)
      .in('bookings.status', ADMIN_ACTIVE_STATUSES),
    supabaseAdmin
      .from('service_slot_bookings')
      .select('dog_ids, status')
      .overlaps('dog_ids', ids)
      .in('status', ADMIN_ACTIVE_STATUSES),
  ]);

  for (const row of (bookingDogsRes.data ?? []) as Array<{ dog_id: string }>) {
    counts.set(row.dog_id, (counts.get(row.dog_id) ?? 0) + 1);
  }

  for (const row of (slotBookingsRes.data ?? []) as Array<{ dog_ids: string[] | null }>) {
    for (const dogId of row.dog_ids ?? []) {
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
}): AdminAgendaItem[] {
  const { rows, profileMap, filterKey = null } = args;

  return rows.flatMap((row) => {
    const profile = profileMap.get(row.user_id);
    const serviceType = row.service_type === 'TARGHETTA' ? null : row.service_type;
    const dogNames = unique(
      (row.booking_dogs ?? [])
        .map((bookingDog) => firstRelation(bookingDog.dogs)?.name ?? '')
        .map((name) => name.trim())
        .filter(Boolean)
    );
    const extrasList = (row.booking_dogs ?? []).map((bookingDog) => bookingDog.extras ?? null);
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
      .map((serviceKey) => {
        const meta = [`${dogNames.length} cane${dogNames.length === 1 ? '' : 'i'}`];
        meta.push(...extraLabels);
        if (row.taxi_option && row.taxi_option !== 'NONE') meta.push('Taxi dog');

        return {
          kind: 'PENSIONE',
          id: row.id,
          userId: row.user_id,
          userName: formatPersonName(profile?.first_name ?? null, profile?.last_name ?? null, profile?.email ?? null),
          userEmail: profile?.email ?? null,
          dogNames,
          serviceKey,
          serviceType,
          serviceVariant: null,
          serviceLabel: getAdminServiceLabel(serviceKey, serviceType, null),
          status: row.status ?? null,
          startAt: buildDateTime(row.start_date, row.arrival_time ?? null),
          endAt: row.end_date ? buildDateTime(row.end_date, row.departure_time ?? null, true) : null,
          totalPrice: row.total_price ?? null,
          notes: row.notes ?? null,
          isActive: isActiveBookingStatus(row.status ?? null),
          meta,
        } satisfies AdminAgendaItem;
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
      (row.dog_ids ?? [])
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
        const meta = [`${dogNames.length} cane${dogNames.length === 1 ? '' : 'i'}`];
        if (row.taxi_enabled) meta.push('Taxi dog');
        if (row.taxi_distance_km) meta.push(`${row.taxi_distance_km} km`);

        return {
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
          status: row.status ?? null,
          startAt: slot?.start_at ?? row.created_at,
          endAt: slot?.end_at ?? null,
          totalPrice: row.total_price ?? null,
          notes: row.notes ?? null,
          isActive: isActiveBookingStatus(row.status ?? null),
          meta,
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
      'id, user_id, service_type, start_date, end_date, arrival_time, departure_time, status, notes, total_price, taxi_option, booking_dogs(id, booking_id, dog_id, extras, dogs(id, name, breed))'
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
      'id, user_id, service_type, service_variant, slot_id, dog_ids, taxi_enabled, taxi_distance_km, taxi_price_eur, total_price, status, notes, created_at, service_slots(id, start_at, end_at, capacity, service_type, service_variant)'
    )
    .in('user_id', ids)
    .order('created_at', { ascending: false });

  return (data ?? []) as ServiceSlotBookingQueryRow[];
}

async function fetchAgendaDataByRange(args: {
  startDate: string;
  endDate: string;
  status?: string | null;
}): Promise<{
  profileMap: Map<string, Profile | ProfileSummaryRow>;
  dogMap: Map<string, Dog>;
  pensioneRows: PensioneBookingQueryRow[];
  slotRows: ServiceSlotBookingQueryRow[];
}> {
  const { startDate, endDate, status = null } = args;

  let pensioneQuery = supabaseAdmin
    .from('bookings')
    .select(
      'id, user_id, service_type, start_date, end_date, arrival_time, departure_time, status, notes, total_price, taxi_option, booking_dogs(id, booking_id, dog_id, extras, dogs(id, name, breed))'
    )
    .lte('start_date', endDate)
    .or(`end_date.is.null,end_date.gte.${startDate}`);

  let slotQuery = supabaseAdmin
    .from('service_slot_bookings')
    .select(
      'id, user_id, service_type, service_variant, slot_id, dog_ids, taxi_enabled, taxi_distance_km, taxi_price_eur, total_price, status, notes, created_at, service_slots!inner(id, start_at, end_at, capacity, service_type, service_variant)'
    )
    .gte('service_slots.start_at', `${startDate}T00:00:00`)
    .lte('service_slots.start_at', `${endDate}T23:59:59`);

  if (status && status !== 'ALL') {
    pensioneQuery = pensioneQuery.eq('status', status);
    slotQuery = slotQuery.eq('status', status);
  }

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
  const dogIds = unique(
    slotRows.flatMap((row) => row.dog_ids ?? [])
  );

  const [profileMap, dogMap] = await Promise.all([
    loadProfilesByIds(userIds),
    loadDogsByIds(dogIds),
  ]);

  return { profileMap, dogMap, pensioneRows, slotRows };
}

export async function searchAdminUsers(search: string, limit = 40): Promise<AdminUserListItem[]> {
  const term = sanitizeSearchTerm(search);
  const pattern = buildIlikePattern(term);

  const [profileRes, dogRes] = await Promise.all([
    term
      ? supabaseAdmin
          .from('profiles')
          .select('user_id, first_name, last_name, phone, email, city')
          .or(
            `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern},fiscal_code.ilike.${pattern},address_line.ilike.${pattern},province.ilike.${pattern}`
          )
          .limit(limit)
      : supabaseAdmin
          .from('profiles')
          .select('user_id, first_name, last_name, phone, email, city')
          .limit(limit)
          .order('last_name', { ascending: true }),
    term
      ? supabaseAdmin
          .from('dogs')
          .select('id, owner_id, name, breed, microchip, size_category, is_active')
          .or(`name.ilike.${pattern},breed.ilike.${pattern},microchip.ilike.${pattern}`)
          .neq('is_active', false)
          .limit(limit)
      : supabaseAdmin
          .from('dogs')
          .select('id, owner_id, name, breed, microchip, size_category, is_active')
          .neq('is_active', false)
          .limit(limit)
          .order('name', { ascending: true }),
  ]);

  const profileRows = (profileRes.data ?? []) as ProfileSummaryRow[];
  const dogRows = ((dogRes.data ?? []) as DogSummaryRow[]).filter((dog) => dog.is_active !== false);

  const userIds = unique([
    ...profileRows.map((row) => row.user_id),
    ...dogRows.map((row) => row.owner_id),
  ]).slice(0, limit);

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

  return userIds.map((userId) => {
    const profile = allProfilesMap.get(userId);
    const dogs = dogsByOwner.get(userId) ?? [];

    return {
      userId,
      fullName: formatPersonName(profile?.first_name ?? null, profile?.last_name ?? null, profile?.email ?? null),
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      city: profile?.city ?? null,
      dogsCount: dogs.length,
      activeBookings: activeCounts.get(userId) ?? 0,
      pendingDocuments: pendingDocumentCounts.get(userId) ?? 0,
      dogNames: dogs.map((dog) => dog.name).filter(Boolean) as string[],
      staffRole: staffRoles.get(userId) ?? null,
    } satisfies AdminUserListItem;
  });
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const [profileRes, dogsRes, passesRes, documentsRes, staffRole, pensioneRows, slotRows] = await Promise.all([
    supabaseAdmin.from('profiles').select(PROFILE_SELECT).eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('dogs').select(DOG_SELECT).eq('owner_id', userId).order('name', { ascending: true }),
    supabaseAdmin
      .from('service_passes')
      .select('id, user_id, service_type, service_variant, product_id, credits_total, credits_used, status, purchased_at, expires_at')
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

  const dogMap = await loadDogsByIds(unique(slotRows.flatMap((row) => row.dog_ids ?? [])));
  const profileMap = new Map<string, Profile | ProfileSummaryRow>();
  if (profile) profileMap.set(userId, profile);

  const activeTimeline = [
    ...buildPensioneAgendaItems({ rows: pensioneRows, profileMap }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
  ]
    .filter((item) => item.isActive)
    .sort(compareAscByStart);

  const historyTimeline = [
    ...buildPensioneAgendaItems({ rows: pensioneRows, profileMap }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
  ]
    .filter((item) => !item.isActive)
    .sort(compareDescByStart);

  const documents = await Promise.all(
    ((documentsRes.data ?? []) as UserDocumentRow[]).map(async (row) =>
      mapDocumentRow(row, await createSignedUrl(row.path))
    )
  );

  return {
    userId,
    profile,
    staffRole,
    dogs,
    servicePasses: (passesRes.data ?? []) as ServicePassRow[],
    documents,
    activeTimeline,
    historyTimeline,
  };
}

export async function searchAdminDogs(search: string, limit = 50): Promise<AdminDogListItem[]> {
  const term = sanitizeSearchTerm(search);
  const pattern = buildIlikePattern(term);

  const [dogsRes, ownerProfilesRes] = await Promise.all([
    term
      ? supabaseAdmin
          .from('dogs')
          .select('id, owner_id, name, breed, microchip, size_category, is_active')
          .or(`name.ilike.${pattern},breed.ilike.${pattern},microchip.ilike.${pattern}`)
          .neq('is_active', false)
          .limit(limit)
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
          .or(
            `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern}`
          )
          .limit(limit)
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

  return dogs.slice(0, limit).map((dog) => {
    const owner = profilesMap.get(dog.owner_id);
    return {
      dogId: dog.id,
      name: dog.name,
      breed: dog.breed ?? null,
      microchip: dog.microchip ?? null,
      sizeCategory: dog.size_category ?? null,
      ownerId: dog.owner_id,
      ownerName: formatPersonName(owner?.first_name ?? null, owner?.last_name ?? null, owner?.email ?? null),
      ownerEmail: owner?.email ?? null,
      ownerPhone: owner?.phone ?? null,
      activeBookings: activeCounts.get(dog.id) ?? 0,
      staffRole: staffRoles.get(dog.owner_id) ?? null,
    } satisfies AdminDogListItem;
  });
}

export async function getAdminDogDetail(dogId: string): Promise<AdminDogDetail | null> {
  const dogRes = await supabaseAdmin.from('dogs').select(DOG_SELECT).eq('id', dogId).maybeSingle();
  const dog = (dogRes.data as Dog | null) ?? null;

  if (!dog) return null;

  const [ownerRes, staffRole, bookingDogsRes, slotRes] = await Promise.all([
    supabaseAdmin.from('profiles').select(PROFILE_SELECT).eq('user_id', dog.owner_id).maybeSingle(),
    getStaffRoleForUserInternal(dog.owner_id),
    supabaseAdmin
      .from('booking_dogs')
      .select(
        'dog_id, bookings!inner(id, user_id, service_type, start_date, end_date, arrival_time, departure_time, status, notes, total_price, taxi_option, booking_dogs(id, booking_id, dog_id, extras, dogs(id, name, breed)))'
      )
      .eq('dog_id', dogId),
    supabaseAdmin
      .from('service_slot_bookings')
      .select(
        'id, user_id, service_type, service_variant, slot_id, dog_ids, taxi_enabled, taxi_distance_km, taxi_price_eur, total_price, status, notes, created_at, service_slots(id, start_at, end_at, capacity, service_type, service_variant)'
      )
      .contains('dog_ids', [dogId]),
  ]);

  const owner = (ownerRes.data as Profile | null) ?? null;
  const profileMap = new Map<string, Profile | ProfileSummaryRow>();
  if (owner) profileMap.set(dog.owner_id, owner);

  const bookingRows = ((bookingDogsRes.data ?? []) as Array<{ bookings?: PensioneBookingQueryRow | PensioneBookingQueryRow[] | null }>)
    .map((row) => firstRelation(row.bookings))
    .filter(Boolean) as PensioneBookingQueryRow[];

  const slotRows = (slotRes.data ?? []) as ServiceSlotBookingQueryRow[];
  const dogMap = new Map<string, Dog>([[dog.id, dog]]);

  const combined = [
    ...buildPensioneAgendaItems({ rows: bookingRows, profileMap }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
  ];

  return {
    dog,
    owner,
    ownerStaffRole: staffRole,
    activeTimeline: combined.filter((item) => item.isActive).sort(compareAscByStart),
    historyTimeline: combined.filter((item) => !item.isActive).sort(compareDescByStart),
  };
}

export async function getAdminDateView(args: {
  startDate: string;
  endDate: string;
  status?: string | null;
}): Promise<AdminDateViewResponse> {
  const { startDate, endDate, status = null } = args;
  const { profileMap, dogMap, pensioneRows, slotRows } = await fetchAgendaDataByRange({
    startDate,
    endDate,
    status,
  });

  const items = [
    ...buildPensioneAgendaItems({ rows: pensioneRows, profileMap }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap }),
  ].sort(compareAscByStart);

  const slots = await listAdminSlots({ startDate, endDate, serviceType: 'ALL' });
  return { items, slots };
}

export async function getAdminServiceView(args: {
  startDate: string;
  endDate: string;
  serviceKey: AdminServiceKey;
  status?: string | null;
}): Promise<AdminAgendaItem[]> {
  const { startDate, endDate, serviceKey, status = null } = args;
  const { profileMap, dogMap, pensioneRows, slotRows } = await fetchAgendaDataByRange({
    startDate,
    endDate,
    status,
  });

  const items = [
    ...buildPensioneAgendaItems({ rows: pensioneRows, profileMap, filterKey: serviceKey }),
    ...buildServiceSlotAgendaItems({ rows: slotRows, profileMap, dogMap, filterKey: serviceKey }),
  ]
    .filter((item) => item.serviceKey === serviceKey)
    .sort(compareAscByStart);

  return items;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const now = new Date();
  const startDate = now.toISOString().slice(0, 10);
  const endDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10);

  const [usersRes, dogsRes, pendingDocsRes, dateView, pendingView] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id', { head: true, count: 'exact' }),
    supabaseAdmin.from('dogs').select('id', { head: true, count: 'exact' }).neq('is_active', false),
    supabaseAdmin
      .from('user_documents')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'PENDING'),
    getAdminDateView({ startDate, endDate, status: 'ALL' }),
    getAdminDateView({ startDate, endDate, status: 'PENDING' }),
  ]);

  const pendingDocumentsRaw = await supabaseAdmin
    .from('user_documents')
    .select('id, user_id, kind, path, created_at, status, accepted_at, rejected_at, staff_note')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(8);

  const pendingDocuments = await Promise.all(
    ((pendingDocumentsRaw.data ?? []) as UserDocumentRow[]).map(async (row) =>
      mapDocumentRow(row, await createSignedUrl(row.path))
    )
  );

  const activeBookings = dateView.items.filter((item) => item.isActive).length;
  const pendingBookings = pendingView.items.length;

  return {
    totals: {
      users: usersRes.count ?? 0,
      dogs: dogsRes.count ?? 0,
      activeBookings,
      pendingBookings,
      pendingDocuments: pendingDocsRes.count ?? 0,
    },
    pendingBookings: pendingView.items.slice(0, 8),
    pendingDocuments,
    upcomingServices: dateView.items.slice(0, 10),
  };
}

export async function listAdminSlots(args: {
  startDate: string;
  endDate: string;
  serviceType: ServiceType | 'ALL';
}): Promise<AdminSlotRecord[]> {
  const { startDate, endDate, serviceType } = args;

  let slotQuery = supabaseAdmin
    .from('service_slots')
    .select('id, service_type, service_variant, start_at, end_at, capacity, is_active, notes, created_at')
    .gte('start_at', `${startDate}T00:00:00`)
    .lte('start_at', `${endDate}T23:59:59`)
    .order('start_at', { ascending: true });

  if (serviceType !== 'ALL') {
    slotQuery = slotQuery.eq('service_type', serviceType);
  }

  const slotsRes = await slotQuery;
  const slots = (slotsRes.data ?? []) as ServiceSlotRow[];

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
      isActive: slot.is_active,
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

export async function updateAdminDog(dogId: string, input: DogInput): Promise<Dog> {
  const { data, error } = await supabaseAdmin
    .from('dogs')
    .update({
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
      show_breed: input.show_breed,
      show_sex: input.show_sex,
      show_size: input.show_size,
      show_microchip: input.show_microchip,
      show_birth_date: input.show_birth_date,
      show_notes: input.show_notes,
      show_coat_color: input.show_coat_color,
      show_temperament: input.show_temperament,
    })
    .eq('id', dogId)
    .select(DOG_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare il cane.');
  }

  return data as Dog;
}

export async function updateAdminDocumentStatus(args: {
  documentId: string;
  status: 'ACCEPTED' | 'REJECTED';
  staffNote?: string | null;
}): Promise<void> {
  const { documentId, status, staffNote = null } = args;
  const now = new Date().toISOString();

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
}

export async function updateAdminBookingStatus(args: {
  kind: AdminBookingKind;
  bookingId: string;
  status: BookingStatus | ServiceStatus;
}): Promise<void> {
  const { kind, bookingId, status } = args;
  const table = kind === 'PENSIONE' ? 'bookings' : 'service_slot_bookings';

  const { error } = await supabaseAdmin
    .from(table)
    .update({ status })
    .eq('id', bookingId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertAdminSlot(input: {
  slotId?: string | null;
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;
  startAt: string;
  endAt: string;
  capacity: number;
  isActive: boolean;
  notes?: string | null;
}): Promise<AdminSlotRecord> {
  const { slotId = null, serviceType, serviceVariant, startAt, endAt, capacity, isActive, notes = null } = input;

  const payload = {
    id: slotId ?? undefined,
    service_type: serviceType,
    service_variant: serviceVariant,
    start_at: startAt,
    end_at: endAt,
    capacity,
    is_active: isActive,
    notes,
  };

  const operation = slotId
    ? supabaseAdmin.from('service_slots').update(payload).eq('id', slotId)
    : supabaseAdmin.from('service_slots').insert(payload);

  const { data, error } = await operation
    .select('id, service_type, service_variant, start_at, end_at, capacity, is_active, notes, created_at')
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
    isActive: data.is_active,
    notes: data.notes ?? null,
  };
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

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    const user = data.users.find((candidate) => (candidate.email ?? '').trim().toLowerCase() === normalizedEmail);
    if (user) return user;
    if (data.users.length < 200) break;
  }

  return null;
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
    .select('user_id, role, is_active, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as StaffAccountRow[];
  const emailMap = await resolveAuthEmails(rows.map((row) => row.user_id));

  return rows.map((row) => ({
    userId: row.user_id,
    email: emailMap.get(row.user_id) ?? null,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function upsertAdminStaffMemberByEmail(args: {
  email: string;
  role: StaffRole;
  isActive: boolean;
}): Promise<AdminStaffMember> {
  const { email, role, isActive } = args;
  const user = await findAuthUserByEmail(email);

  if (!user?.id) {
    throw new Error('Nessun account trovato per questa email.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .upsert(
      {
        user_id: user.id,
        role,
        is_active: isActive,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, role, is_active, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare il membro staff.');
  }

  return {
    userId: data.user_id,
    email: user.email ?? null,
    role: data.role,
    isActive: data.is_active,
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
