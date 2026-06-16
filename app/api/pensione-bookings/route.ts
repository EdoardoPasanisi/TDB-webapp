import { NextResponse } from 'next/server';
import { createManageStaffNotifications } from '@/lib/admin/notifications';
import { formatPersonName } from '@/lib/admin/utils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { RouteAuthError, requireRequestUser, routeAuthErrorResponse } from '@/lib/server/routeAuth';
import {
  buildMissingRequiredCustomerBookingMessage,
  getMissingRequiredCustomerBookingFields,
  type CustomerBookingRequirementProfile,
} from '@/lib/bookings/customerBookingRequirements';
import { DEFAULT_TAXI } from '@/lib/services/pensione/constants';
import { isPlainObject, normalizeUuid, parsePensioneBookingInput } from '@/lib/services/pensione/parseInput';
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
    const input = parsePensioneBookingInput(rawBody);

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
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per continuare con la prenotazione.'),
      });
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
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per modificare la prenotazione.'),
      });
    }

    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti ad annullare la prenotazione. Riprova.') },
      { status: 500 }
    );
  }
}
