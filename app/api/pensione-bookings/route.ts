import { NextResponse } from 'next/server';
import { createManageStaffNotifications } from '@/lib/admin/notifications';
import { formatPersonName } from '@/lib/admin/utils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { RouteAuthError, requireRequestUser } from '@/lib/server/routeAuth';
import {
  buildMissingRequiredCustomerBookingMessage,
  getMissingRequiredCustomerBookingFields,
  type CustomerBookingRequirementProfile,
} from '@/lib/bookings/customerBookingRequirements';
import { DEFAULT_TAXI } from '@/lib/services/pensione/constants';
import type { SavePensioneBookingInput } from '@/lib/services/pensione/api';
import type { DogLite, PerDogForm } from '@/lib/services/pensione/types';
import {
  buildExtrasPayload,
  computeDaysCount,
  computePerDogTotals,
  computePricing,
  validateTimeWindow,
} from '@/lib/services/pensione/utils';
import type {
  AccommodationKey,
  BookingDogExtras,
  BookingStatus,
  TaxiDistanceBand,
  TaxiOption,
} from '@/types/booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  'CATTERY',
]);
const EDITABLE_STATUSES = new Set<BookingStatus>(['PENDING', 'CONFIRMED']);

type OwnedDogRow = {
  id: string;
  owner_id: string;
  name: string;
  size_category: DogLite['size_category'];
  grooming_difficulty: DogLite['grooming_difficulty'];
};

type StoredBookingRow = {
  id: string;
  user_id: string;
  service_type: string;
  status: BookingStatus | null;
  dog_id: string | null;
  start_date: string;
  end_date: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  notes: string | null;
  dogs_count: number | null;
  taxi_option: TaxiOption | null;
  taxi_distance_band: TaxiDistanceBand | null;
  taxi_price: number | null;
  taxi_pickup_time: string | null;
  taxi_return_time: string | null;
  alloggio_total_full: number | null;
  alloggio_discount_percent: number | null;
  alloggio_total_discounted: number | null;
  extras_total: number | null;
  total_price: number | null;
};

type StoredBookingDogRow = {
  booking_id: string;
  dog_id: string;
  accommodation_type: AccommodationKey;
  accommodation_price_per_day: number;
  days_count: number;
  accommodation_subtotal: number;
  extras: BookingDogExtras | null;
  extras_subtotal: number;
  per_dog_total: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUuid(value: unknown): string | null {
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
  const therapy = normalizeTherapy(value.therapy);
  const therapyNotes = String(value.therapyNotes ?? '');

  if (!ACCOMMODATION_KEYS.has(accommodationType)) return null;
  if (grooming === null || vaccine === null) return null;
  if (trackingSessions === null || fitnessSessions === null || walkSessions === null) return null;
  if (therapy === null || therapy === '') return null;
  if (therapy === 'YES' && !therapyNotes.trim()) return null;

  return {
    accommodationType,
    grooming,
    vaccine,
    trackingSessions,
    fitnessSessions,
    walkSessions,
    therapy,
    therapyNotes,
  };
}

function parseInput(body: unknown): SavePensioneBookingInput | null {
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

  for (const dogId of selectedDogIds) {
    const form = parsePerDogForm(body.perDogForm[dogId]);
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

function buildBookingPayload(args: {
  firstDogId: string;
  input: SavePensioneBookingInput;
  pricing: ReturnType<typeof computePricing>;
}) {
  const { firstDogId, input, pricing } = args;

  const taxiPickupTime =
    input.taxiOption === 'ONE_WAY' || input.taxiOption === 'ROUND_TRIP' ? input.arrivalTime : null;
  const taxiReturnTime =
    input.taxiOption === 'RETURN_ONLY' || input.taxiOption === 'ROUND_TRIP' ? input.departureTime : null;

  return {
    dog_id: firstDogId,
    service_type: 'PENSIONE',
    start_date: input.startDate,
    end_date: input.endDate,
    arrival_time: input.arrivalTime,
    departure_time: input.departureTime,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    dogs_count: pricing.dogsCount,
    taxi_option: input.taxiOption,
    taxi_distance_band: input.taxiDistanceBand,
    taxi_price: pricing.taxiPrice,
    taxi_pickup_time: taxiPickupTime,
    taxi_return_time: taxiReturnTime,
    alloggio_total_full: pricing.alloggioTotalFull,
    alloggio_discount_percent: pricing.discountPercent,
    alloggio_total_discounted: pricing.alloggioTotalDiscounted,
    extras_total: pricing.extrasTotal,
    total_price: pricing.totalPrice,
  };
}

function buildBookingDogsPayload(args: {
  bookingId: string;
  selectedDogIds: string[];
  dogs: Map<string, DogLite>;
  perDogForm: Record<string, PerDogForm>;
  daysCount: number;
}): StoredBookingDogRow[] {
  const { bookingId, selectedDogIds, dogs, perDogForm, daysCount } = args;

  return selectedDogIds.map((dogId) => {
    const dog = dogs.get(dogId);
    const form = perDogForm[dogId];

    if (!dog || !form) {
      throw new Error('Dati cane mancanti.');
    }

    const extras = buildExtrasPayload(form);
    const totals = computePerDogTotals({ dog, form, daysCount });

    return {
      booking_id: bookingId,
      dog_id: dogId,
      accommodation_type: form.accommodationType,
      accommodation_price_per_day: totals.accommodation_price_per_day,
      days_count: daysCount,
      accommodation_subtotal: totals.accommodation_subtotal,
      extras,
      extras_subtotal: totals.extras_subtotal,
      per_dog_total: totals.per_dog_total,
    };
  });
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);

    const rawBody = await request.json().catch(() => null);
    const input = parseInput(rawBody);

    if (!input) {
      return NextResponse.json({ error: 'Payload prenotazione non valido.' }, { status: 400 });
    }

    if (input.endDate < input.startDate) {
      return NextResponse.json(
        { error: 'La data di partenza deve essere uguale o successiva alla data di arrivo.' },
        { status: 400 }
      );
    }

    const arrivalError = validateTimeWindow('L’orario di arrivo', input.arrivalTime, input.startDate);
    if (arrivalError) {
      return NextResponse.json({ error: arrivalError }, { status: 400 });
    }

    const departureError = validateTimeWindow('L’orario di partenza', input.departureTime, input.endDate);
    if (departureError) {
      return NextResponse.json({ error: departureError }, { status: 400 });
    }

    const daysCount = computeDaysCount(input.startDate, input.endDate, input.departureTime);
    if (daysCount <= 0) {
      return NextResponse.json({ error: 'Date prenotazione non valide.' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: 'Impossibile verificare i dati del profilo.' },
        { status: 500 }
      );
    }

    const missingRequiredFields = getMissingRequiredCustomerBookingFields(
      (profile ?? null) as CustomerBookingRequirementProfile | null
    );

    if (missingRequiredFields.length > 0) {
      return NextResponse.json(
        { error: buildMissingRequiredCustomerBookingMessage(missingRequiredFields) },
        { status: 400 }
      );
    }

    const { data: ownedDogs, error: dogsError } = await supabaseAdmin
      .from('dogs')
      .select('id, owner_id, name, size_category, grooming_difficulty')
      .in('id', input.selectedDogIds)
      .eq('owner_id', userId)
      .eq('is_active', true);

    if (dogsError) {
      return NextResponse.json({ error: 'Errore caricando i cani selezionati.' }, { status: 400 });
    }

    const ownedDogRows = (ownedDogs ?? []) as OwnedDogRow[];
    if (ownedDogRows.length !== input.selectedDogIds.length) {
      return NextResponse.json({ error: 'Uno o più cani selezionati non sono validi.' }, { status: 400 });
    }

    const dogMap = new Map<string, DogLite>(
      ownedDogRows.map((dog) => [
        dog.id,
        {
          id: dog.id,
          name: dog.name,
          photo_path: null,
          updated_at: null,
          size_category: dog.size_category ?? null,
          grooming_difficulty: dog.grooming_difficulty ?? null,
        },
      ])
    );

    const pricing = computePricing({
      selectedDogIds: input.selectedDogIds,
      daysCount,
      dogs: Array.from(dogMap.values()),
      perDogForm: input.perDogForm,
      taxiOption: input.taxiOption,
      taxiDistanceBand: input.taxiDistanceBand ?? DEFAULT_TAXI.distanceBand,
    });

    if (pricing.totalPrice <= 0) {
      return NextResponse.json({ error: 'Impossibile calcolare il prezzo.' }, { status: 400 });
    }

    const bookingPayload = buildBookingPayload({
      firstDogId: input.selectedDogIds[0],
      input,
      pricing,
    });
    const ownerName = formatPersonName(
      (profile as { first_name?: string | null } | null)?.first_name ?? null,
      (profile as { last_name?: string | null } | null)?.last_name ?? null
    );
    const dogsLabel =
      ownedDogRows.length === 1
        ? ownedDogRows[0]?.name ?? '1 cane'
        : `${ownedDogRows.length} cani`;

    if (input.bookingId) {
      const { data: previousBooking, error: previousBookingError } = await supabaseAdmin
        .from('bookings')
        .select(
          'id, user_id, service_type, status, dog_id, start_date, end_date, arrival_time, departure_time, notes, dogs_count, taxi_option, taxi_distance_band, taxi_price, taxi_pickup_time, taxi_return_time, alloggio_total_full, alloggio_discount_percent, alloggio_total_discounted, extras_total, total_price'
        )
        .eq('id', input.bookingId)
        .eq('user_id', userId)
        .maybeSingle();

      const previousBookingRow = (previousBooking ?? null) as StoredBookingRow | null;

      if (previousBookingError || !previousBookingRow || previousBookingRow.service_type !== 'PENSIONE') {
        return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
      }

      if (!EDITABLE_STATUSES.has(previousBookingRow.status ?? 'PENDING')) {
        return NextResponse.json({ error: 'La prenotazione non è modificabile nello stato attuale.' }, { status: 400 });
      }

      const { data: previousBookingDogs, error: previousBookingDogsError } = await supabaseAdmin
        .from('booking_dogs')
        .select(
          'booking_id, dog_id, accommodation_type, accommodation_price_per_day, days_count, accommodation_subtotal, extras, extras_subtotal, per_dog_total'
        )
        .eq('booking_id', input.bookingId);

      if (previousBookingDogsError) {
        return NextResponse.json({ error: 'Errore caricando il dettaglio prenotazione.' }, { status: 400 });
      }

      const previousBookingDogRows = (previousBookingDogs ?? []) as StoredBookingDogRow[];

      const { error: bookingUpdateError } = await supabaseAdmin
        .from('bookings')
        .update(bookingPayload)
        .eq('id', input.bookingId)
        .eq('user_id', userId);

      if (bookingUpdateError) {
        return NextResponse.json({ error: 'Errore nel salvataggio della prenotazione.' }, { status: 400 });
      }

      const { error: deleteDogsError } = await supabaseAdmin
        .from('booking_dogs')
        .delete()
        .eq('booking_id', input.bookingId);

      if (deleteDogsError) {
        await supabaseAdmin.from('bookings').update(previousBookingRow).eq('id', input.bookingId).eq('user_id', userId);
        return NextResponse.json({ error: 'Errore aggiornando il dettaglio per cane.' }, { status: 500 });
      }

      const nextBookingDogs = buildBookingDogsPayload({
        bookingId: input.bookingId,
        selectedDogIds: input.selectedDogIds,
        dogs: dogMap,
        perDogForm: input.perDogForm,
        daysCount,
      });

      const { error: insertDogsError } = await supabaseAdmin
        .from('booking_dogs')
        .insert(nextBookingDogs);

      if (insertDogsError) {
        await supabaseAdmin.from('bookings').update(previousBookingRow).eq('id', input.bookingId).eq('user_id', userId);
        if (previousBookingDogRows.length > 0) {
          await supabaseAdmin.from('booking_dogs').insert(previousBookingDogRows);
        }
        return NextResponse.json(
          { error: 'La prenotazione non è stata aggiornata correttamente. Riprova.' },
          { status: 500 }
        );
      }

      try {
        await createManageStaffNotifications({
          type: 'BOOKING_ACTION_REQUIRED',
          title: 'Prenotazione pensione aggiornata',
          body: `${ownerName} ha modificato una pensione per ${dogsLabel}.`,
          data: {
            href: '/admin?tab=services',
            adminTab: 'services',
            bookingId: input.bookingId,
          },
        });
      } catch (notificationError) {
        console.error('Admin booking notification failed:', notificationError);
      }

      return NextResponse.json({ bookingId: input.bookingId });
    }

    const { data: bookingInsert, error: bookingInsertError } = await supabaseAdmin
      .from('bookings')
      .insert({
        user_id: userId,
        status: 'PENDING',
        ...bookingPayload,
      })
      .select('id')
      .single();

    if (bookingInsertError || !bookingInsert?.id) {
      return NextResponse.json({ error: 'Errore nel salvataggio della prenotazione.' }, { status: 400 });
    }

    const bookingId = String(bookingInsert.id);
    const bookingDogsPayload = buildBookingDogsPayload({
      bookingId,
      selectedDogIds: input.selectedDogIds,
      dogs: dogMap,
      perDogForm: input.perDogForm,
      daysCount,
    });

    const { error: bookingDogsError } = await supabaseAdmin
      .from('booking_dogs')
      .insert(bookingDogsPayload);

    if (bookingDogsError) {
      await supabaseAdmin.from('bookings').delete().eq('id', bookingId).eq('user_id', userId);
      return NextResponse.json(
        { error: 'La prenotazione principale è stata salvata, ma il dettaglio per cane non è andato a buon fine.' },
        { status: 500 }
      );
    }

    try {
      await createManageStaffNotifications({
        type: 'BOOKING_ACTION_REQUIRED',
        title: 'Nuova richiesta pensione',
        body: `${ownerName} ha inviato una richiesta pensione per ${dogsLabel}.`,
        data: {
          href: '/admin?tab=services',
          adminTab: 'services',
          bookingId,
        },
      });
    } catch (notificationError) {
      console.error('Admin booking notification failed:', notificationError);
    }

    return NextResponse.json({ bookingId });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per continuare con la prenotazione.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a salvare la prenotazione. Riprova.') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const rawBody = await request.json().catch(() => null);
    const bookingId = isPlainObject(rawBody) ? normalizeUuid(rawBody.bookingId) : null;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Manca il riferimento della prenotazione oppure non è valido.' },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, service_type, status')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .maybeSingle();

    const bookingRow = (booking ?? null) as Pick<StoredBookingRow, 'id' | 'user_id' | 'service_type' | 'status'> | null;

    if (bookingError || !bookingRow || bookingRow.service_type !== 'PENSIONE') {
      return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    }

    if (bookingRow.status === 'CANCELLED') {
      return NextResponse.json({ bookingId, cancelled: true, alreadyCancelled: true });
    }

    if (!EDITABLE_STATUSES.has(bookingRow.status ?? 'PENDING')) {
      return NextResponse.json(
        { error: 'La prenotazione non può essere annullata nello stato attuale.' },
        { status: 400 }
      );
    }

    const { error: cancelError } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('id', bookingId)
      .eq('user_id', userId);

    if (cancelError) {
      return NextResponse.json({ error: 'Errore durante l’annullamento della prenotazione.' }, { status: 500 });
    }

    return NextResponse.json({ bookingId, cancelled: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per modificare la prenotazione.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti ad annullare la prenotazione. Riprova.') },
      { status: 500 }
    );
  }
}
