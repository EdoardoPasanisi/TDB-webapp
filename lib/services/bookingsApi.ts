// FILE: lib/services/bookingsApi.ts
import { supabase } from '@/lib/supabaseClient';
import type {
  AccommodationKey,
  BookingDogExtras,
  BookingListItem,
  BookingRow,
  BookingDogRow,
  ServiceType,
  BookingStatus,
} from '@/types/booking';

type DogRow = { id: string; name: string | null; breed?: string | null };

// supabase embedded può tornare un oggetto o un array a seconda della relazione/hint
type DogJoin = DogRow | DogRow[] | null;

type BookingDogDbRow = {
  id: string;
  booking_id: string;
  dog_id: string;

  accommodation_type?: AccommodationKey | null;
  accommodation_price_per_day?: number | null;
  days_count?: number | null;

  accommodation_subtotal?: number | null;
  extras: BookingDogExtras | null;
  extras_subtotal?: number | null;
  per_dog_total?: number | null;

  dogs?: DogJoin; // join
};

// Tipo “list row”: SOLO i campi effettivamente selezionati nelle liste
type BookingListDbRow = Pick<
  BookingRow,
  | 'id'
  | 'user_id'
  | 'service_type'
  | 'status'
  | 'start_date'
  | 'end_date'
  | 'arrival_time'
  | 'departure_time'
  | 'dogs_count'
  | 'total_price'
  | 'taxi_option'
> & {
  booking_dogs?: BookingDogDbRow[] | null;
};

// Tipo “detail row”: qui selezioniamo molti campi (quasi tutti quelli richiesti da BookingRow)
type BookingDetailDbRow = BookingRow & {
  booking_dogs?: BookingDogDbRow[] | null;
};

export type BookingDetail = {
  booking: BookingRow;
  bookingDogs: Array<
    BookingDogRow & {
      dogName: string;
      dogBreed?: string | null;
    }
  >;
};

function firstDog(join: DogJoin): DogRow | null {
  if (!join) return null;
  return Array.isArray(join) ? join[0] ?? null : join;
}

function normalizeDogNames(row: { booking_dogs?: BookingDogDbRow[] | null }): string[] {
  const names = new Set<string>();

  for (const bd of row.booking_dogs ?? []) {
    const dog = firstDog(bd.dogs ?? null);
    const n = (dog?.name ?? '').trim();
    if (n) names.add(n);
  }

  return Array.from(names);
}

function summarizeExtras(extrasList: Array<BookingDogExtras | null | undefined>): string {
  let grooming = 0;
  let vaccine = 0;
  let tracking = 0;
  let fitness = 0;
  let walk = 0;
  let trekking = 0;

  for (const ex of extrasList) {
    if (!ex) continue;
    if (ex.grooming) grooming += 1;
    if (ex.vaccine) vaccine += 1;
    if (typeof ex.trackingSessions === 'number') tracking += ex.trackingSessions;
    if (typeof ex.fitnessSessions === 'number') fitness += ex.fitnessSessions;
    if (typeof ex.walkSessions === 'number') walk += ex.walkSessions;
    if (typeof ex.trekkingSessions === 'number') trekking += ex.trekkingSessions;
  }

  const parts: string[] = [];
  if (grooming > 0) parts.push('Toelettatura');
  if (vaccine > 0) parts.push('Vaccino');
  if (tracking > 0) parts.push(`Ricerca olfattiva (${tracking})`);
  if (fitness > 0) parts.push(`Fitness (${fitness})`);
  if (walk > 0) parts.push(`Passeggiate (${walk})`);
  if (trekking > 0) parts.push(`Trekking (${trekking})`);

  return parts.length > 0 ? parts.join(', ') : 'Nessun extra';
}

function isFutureOrOngoing(startIso: string, endIso: string | null): boolean {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayIso = `${yyyy}-${mm}-${dd}`;

  if (endIso) return endIso >= todayIso;
  return startIso >= todayIso;
}

export async function getFutureBookingsForUser(userId: string): Promise<BookingListItem[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, user_id, service_type, status, start_date, end_date, arrival_time, departure_time, dogs_count, total_price, taxi_option, booking_dogs(id, booking_id, dog_id, extras, dogs(id, name))'
    )
    .eq('user_id', userId)
    .order('start_date', { ascending: true });

  if (error) throw error;

  const rows = (data as BookingListDbRow[] | null) ?? [];
  const filtered = rows.filter((r) => isFutureOrOngoing(r.start_date, r.end_date ?? null));

  return filtered.map((r) => {
    const dogNames = normalizeDogNames(r);
    const extrasSummary = summarizeExtras((r.booking_dogs ?? []).map((bd) => bd.extras));

    return {
      id: r.id,
      service_type: r.service_type as ServiceType,
      status: (r.status as BookingStatus) ?? null,
      start_date: r.start_date,
      end_date: r.end_date ?? null,
      arrival_time: r.arrival_time ?? null,
      departure_time: r.departure_time ?? null,
      dogs_count: r.dogs_count ?? null,
      total_price: r.total_price ?? null,
      taxi_option: r.taxi_option ?? null,
      dogNames,
      extrasSummary,
    };
  });
}

/**
 * Dettaglio prenotazione + righe booking_dogs (con nome cane).
 * Assunzione: booking.id è accessibile solo se user_id == userId.
 */
export async function getBookingDetailForUser(
  userId: string,
  bookingId: string
): Promise<BookingDetail | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, user_id, dog_id, service_type, start_date, end_date, arrival_time, departure_time, notes, status, dogs_count, taxi_option, taxi_distance_band, taxi_price, taxi_pickup_time, taxi_return_time, alloggio_total_full, alloggio_discount_percent, alloggio_total_discounted, extras_total, total_price, booking_dogs(id, booking_id, dog_id, accommodation_type, accommodation_price_per_day, days_count, accommodation_subtotal, extras, extras_subtotal, per_dog_total, dogs(id, name, breed))'
    )
    .eq('id', bookingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as BookingDetailDbRow;

  const booking: BookingRow = {
    ...(row as BookingRow),
    end_date: row.end_date ?? null,
    arrival_time: row.arrival_time ?? null,
    departure_time: row.departure_time ?? null,
    notes: row.notes ?? null,
    status: row.status ?? null,
    dogs_count: row.dogs_count ?? null,
    taxi_option: row.taxi_option ?? null,
    taxi_distance_band: row.taxi_distance_band ?? null,
    taxi_price: row.taxi_price ?? null,
    taxi_pickup_time: row.taxi_pickup_time ?? null,
    taxi_return_time: row.taxi_return_time ?? null,
    alloggio_total_full: row.alloggio_total_full ?? null,
    alloggio_discount_percent: row.alloggio_discount_percent ?? null,
    alloggio_total_discounted: row.alloggio_total_discounted ?? null,
    extras_total: row.extras_total ?? null,
    total_price: row.total_price ?? null,
  };

  const bookingDogs = (row.booking_dogs ?? []).map((bd) => {
    const dog = firstDog(bd.dogs ?? null);
    const dogName = (dog?.name ?? '').trim() || 'Cane';
    const dogBreed = dog?.breed ?? null;

    const mapped: BookingDogRow & { dogName: string; dogBreed?: string | null } = {
      id: bd.id,
      booking_id: bd.booking_id,
      dog_id: bd.dog_id,
      accommodation_type: bd.accommodation_type ?? 'BOX',
      accommodation_price_per_day: bd.accommodation_price_per_day ?? 0,
      days_count: bd.days_count ?? 0,
      accommodation_subtotal: bd.accommodation_subtotal ?? 0,
      extras: bd.extras ?? {},
      extras_subtotal: bd.extras_subtotal ?? 0,
      per_dog_total: bd.per_dog_total ?? 0,
      dogName,
      dogBreed,
    };

    return mapped;
  });

  return { booking, bookingDogs };
}

/**
 * Prenotazioni PENSIONE che intersecano un range (per calendario mensile).
 * Range in formato DATE (YYYY-MM-DD): [startDate, endDateExclusive)
 */
export async function getPensioneBookingsForUserInRange(args: {
  userId: string;
  startDate: string; // YYYY-MM-DD inclusive
  endDateExclusive: string; // YYYY-MM-DD exclusive
}): Promise<
  Array<
    Pick<
      BookingRow,
      'id' | 'service_type' | 'start_date' | 'end_date' | 'status' | 'total_price' | 'taxi_option' | 'dogs_count'
      | 'arrival_time'
      | 'departure_time'
    > & { dogNames: string[]; extrasSummary: string }
  >
> {
  const { userId, startDate, endDateExclusive } = args;

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, user_id, service_type, status, start_date, end_date, arrival_time, departure_time, dogs_count, total_price, taxi_option, booking_dogs(id, booking_id, dog_id, extras, dogs(id, name))'
    )
    .eq('user_id', userId)
    .in('status', ['PENDING', 'CONFIRMED', 'PAID'])
    .lt('start_date', endDateExclusive)
    .or(`end_date.is.null,end_date.gte.${startDate}`)
    .order('start_date', { ascending: true });

  if (error) throw error;

  const rows = (data as BookingListDbRow[] | null) ?? [];

  return rows.map((r) => {
    const dogNames = normalizeDogNames(r);
    const extrasSummary = summarizeExtras((r.booking_dogs ?? []).map((bd) => bd.extras));

    return {
      id: r.id,
      service_type: r.service_type,
      start_date: r.start_date,
      end_date: r.end_date ?? null,
      arrival_time: r.arrival_time ?? null,
      departure_time: r.departure_time ?? null,
      status: r.status ?? null,
      total_price: r.total_price ?? null,
      taxi_option: r.taxi_option ?? null,
      dogs_count: r.dogs_count ?? null,
      dogNames,
      extrasSummary,
    };
  });
}
