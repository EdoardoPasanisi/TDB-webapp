import { NextRequest, NextResponse } from 'next/server';
import { RouteAuthError, requireRequestUser, routeAuthErrorResponse } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServiceSlotDogIds, mapServiceSlotDogs } from '@/lib/services/serviceSlotDogs';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { BookingRow, BookingDogRow, BookingStatus, BookingDogExtras } from '@/types/booking';
import type { ServiceType, ServiceVariant } from '@/types/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DogMini = { id: string; name: string | null; breed: string | null };

type ServiceSlotRowRelation = {
  id: string;
  start_at: string;
  end_at: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
};

type ServiceSlotBookingQueryRow = {
  id: string;
  user_id: string;
  slot_id: string | null;
  service_type: ServiceType | null;
  service_variant: ServiceVariant | null;
  status: BookingStatus | null;
  notes: string | null;
  taxi_enabled: boolean | null;
  taxi_distance_km: number | null;
  taxi_price_eur: number | null;
  credits_spent: number | null;
  total_price: number | null;
  created_at: string | null;
  dog_id: string | null;
  dog_ids: string[] | null;
  service_slots: ServiceSlotRowRelation[] | ServiceSlotRowRelation | null;
};

type BookingDogQueryRow = BookingDogRow & {
  extras: BookingDogExtras | null;
  dogs: DogMini[] | DogMini | null;
};

const PENSIONE_SELECT =
  'id, user_id, dog_id, service_type, start_date, end_date, arrival_time, departure_time, notes, status, dogs_count, taxi_option, taxi_distance_band, taxi_price, taxi_pickup_time, taxi_return_time, alloggio_total_full, alloggio_discount_percent, alloggio_total_discounted, extras_total, total_price, created_at, updated_at';

const BOOKING_DOG_SELECT =
  'id, booking_id, dog_id, accommodation_type, accommodation_price_per_day, days_count, accommodation_subtotal, extras, extras_subtotal, per_dog_total, dogs:dog_id(id, name, breed)';

const SLOT_SELECT =
  'id, user_id, slot_id, dog_id, dog_ids, service_type, service_variant, status, notes, taxi_enabled, taxi_distance_km, taxi_price_eur, credits_spent, total_price, created_at, service_slots:slot_id(id, start_at, end_at, service_type, service_variant)';

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function pickGroupStatus(statuses: Array<BookingStatus | null | undefined>): BookingStatus | null {
  const s = statuses.map((x) => (x ?? '').toUpperCase());
  if (s.includes('PAID')) return 'PAID';
  if (s.includes('CONFIRMED')) return 'CONFIRMED';
  if (s.includes('PENDING')) return 'PENDING';
  if (s.includes('CANCELLED')) return 'CANCELLED';
  return statuses.find((x) => x != null) ?? null;
}

function sumMaybe(nums: Array<number | null | undefined>): number | null {
  const clean = nums.filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  let user: { userId: string };
  try {
    user = await requireRequestUser(request);
  } catch (err) {
    if (err instanceof RouteAuthError) {
      return routeAuthErrorResponse(err, { error: err.message });
    }
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
  }

  const { bookingId } = await params;
  const { userId } = user;

  try {
    // Parallel initial lookup: try both tables by ID
    const [pensioneRes, slotByIdRes] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select(PENSIONE_SELECT)
        .eq('id', bookingId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('service_slot_bookings')
        .select(SLOT_SELECT)
        .eq('id', bookingId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (pensioneRes.data) {
      const booking = pensioneRes.data as unknown as BookingRow;

      const { data: bookingDogsData, error: bookingDogsError } = await supabaseAdmin
        .from('booking_dogs')
        .select(BOOKING_DOG_SELECT)
        .eq('booking_id', bookingId);

      if (bookingDogsError) {
        return NextResponse.json({ error: 'Errore nel caricamento dei dettagli prenotazione.' }, { status: 500 });
      }

      const bookingDogs = ((bookingDogsData ?? []) as BookingDogQueryRow[]).map((raw) => {
        const dog = Array.isArray(raw.dogs) ? (raw.dogs[0] ?? null) : (raw.dogs as DogMini | null);
        return {
          id: raw.id,
          booking_id: raw.booking_id,
          dog_id: raw.dog_id,
          accommodation_type: raw.accommodation_type,
          accommodation_price_per_day: raw.accommodation_price_per_day ?? 0,
          days_count: raw.days_count ?? 0,
          accommodation_subtotal: raw.accommodation_subtotal ?? 0,
          extras: (raw.extras ?? {}) as BookingDogExtras,
          extras_subtotal: raw.extras_subtotal ?? 0,
          per_dog_total: raw.per_dog_total ?? 0,
          created_at: raw.created_at,
          updated_at: raw.updated_at,
          dogName: dog?.name ?? '',
          dogBreed: dog?.breed ?? null,
        };
      });

      return NextResponse.json({ kind: 'PENSIONE', booking, bookingDogs });
    }

    // Slot booking — find representative row
    let repRow: ServiceSlotBookingQueryRow | null =
      (slotByIdRes.data ?? null) as ServiceSlotBookingQueryRow | null;

    if (!repRow) {
      // bookingId might be the slot_id itself (aggregated view)
      const { data, error: slotErr } = await supabaseAdmin
        .from('service_slot_bookings')
        .select(SLOT_SELECT)
        .eq('slot_id', bookingId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (slotErr) {
        return NextResponse.json({ error: 'Errore nel caricamento della prenotazione.' }, { status: 500 });
      }

      repRow = (data ?? null) as ServiceSlotBookingQueryRow | null;
    }

    if (!repRow) {
      return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    }

    if (!repRow.slot_id) {
      return NextResponse.json({ error: 'Prenotazione non valida (slot mancante).' }, { status: 422 });
    }

    // Fetch all sibling rows for this slot
    const { data: allRowsData, error: allRowsError } = await supabaseAdmin
      .from('service_slot_bookings')
      .select(SLOT_SELECT)
      .eq('slot_id', repRow.slot_id)
      .eq('user_id', userId);

    if (allRowsError) {
      return NextResponse.json({ error: 'Errore nel caricamento della prenotazione.' }, { status: 500 });
    }

    const groupedRows = (allRowsData?.length ?? 0) > 0
      ? (allRowsData as ServiceSlotBookingQueryRow[])
      : [repRow];

    // Collect all dog IDs across grouped rows and fetch dog details
    const dogIds = Array.from(new Set(groupedRows.flatMap((row) => getServiceSlotDogIds(row))));
    const dogMap = new Map<string, DogMini>();

    if (dogIds.length > 0) {
      const { data: dogsData } = await supabaseAdmin
        .from('dogs')
        .select('id, name, breed')
        .in('id', dogIds);

      for (const d of (dogsData ?? []) as DogMini[]) {
        dogMap.set(d.id, { id: d.id, name: d.name ?? null, breed: d.breed ?? null });
      }
    }

    const slot = firstRelation(groupedRows[0]?.service_slots) ?? firstRelation(repRow.service_slots);
    const serviceType = repRow.service_type ?? slot?.service_type;

    if (!serviceType) {
      return NextResponse.json({ error: 'Prenotazione non valida (servizio mancante).' }, { status: 422 });
    }

    const dogs = Array.from(
      new Map(
        groupedRows
          .flatMap((row) => mapServiceSlotDogs(row, dogMap))
          .map((dog) => [dog.id, dog] as const)
      ).values()
    );

    const taxiRow = groupedRows.find((r) => !!r.taxi_enabled) ?? repRow;

    return NextResponse.json({
      kind: 'SERVICE_SLOT',
      slotBooking: {
        rep_id: repRow.id,
        slot_id: repRow.slot_id,
        user_id: repRow.user_id,
        service_type: serviceType,
        service_variant: repRow.service_variant ?? slot?.service_variant ?? null,
        status: pickGroupStatus(groupedRows.map((r) => r.status)),
        notes: groupedRows.map((r) => r.notes).find(Boolean) ?? repRow.notes ?? null,
        start_at: slot?.start_at ?? '',
        end_at: slot?.end_at ?? '',
        dogs,
        taxi_enabled: !!taxiRow.taxi_enabled,
        taxi_distance_km: taxiRow.taxi_distance_km ?? null,
        taxi_price_eur: taxiRow.taxi_price_eur ?? null,
        credits_spent: groupedRows.reduce((acc, r) => acc + (Number(r.credits_spent) || 0), 0),
        total_price: sumMaybe(groupedRows.map((r) => r.total_price)),
        booking_ids: groupedRows.map((r) => r.id),
        created_at: repRow.created_at ?? undefined,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Errore nel caricamento della prenotazione.') },
      { status: 500 }
    );
  }
}
