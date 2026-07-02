// Logica condivisa di costruzione/salvataggio prenotazioni pensione.
// Usata dalla rotta utente (app/api/pensione-bookings) e dalla rotta gestionale
// (app/api/admin/pensione-bookings) per creare prenotazioni per conto di un utente.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { formatPersonName } from '@/lib/admin/utils';
import { accommodationOptionsForSpecies, DEFAULT_TAXI } from '@/lib/services/pensione/constants';
import {
  buildExtrasPayload,
  computeDaysCount,
  computePerDogTotals,
  computePricing,
  validateTimeWindow,
} from '@/lib/services/pensione/utils';
import { getMissingRequiredPetBookingFields } from '@/lib/bookings/customerBookingRequirements';
import type { SavePensioneBookingInput } from '@/lib/services/pensione/api';
import type { DogLite, PerDogForm } from '@/lib/services/pensione/types';
import type {
  AccommodationKey,
  BookingDogExtras,
  BookingStatus,
  TaxiDistanceBand,
  TaxiOption,
} from '@/types/booking';

export type OwnedDogRow = {
  id: string;
  owner_id: string;
  name: string;
  species: import('@/types/dog').PetSpecies | null;
  microchip: string | null;
  birth_date: string | null;
  libretto_name: string | null;
  size_category: DogLite['size_category'];
  grooming_difficulty: DogLite['grooming_difficulty'];
};

export type StoredBookingDogRow = {
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

/** Errore "umano" con status HTTP, da mappare in NextResponse. */
export class PensioneBookingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PensioneBookingError';
    this.status = status;
  }
}

export function buildBookingPayload(args: {
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

export function buildBookingDogsPayload(args: {
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
      throw new PensioneBookingError('Dati cane mancanti.');
    }

    const extras = buildExtrasPayload(form);
    const totals = computePerDogTotals({ dog, form, daysCount, totalDogs: selectedDogIds.length });

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

/**
 * Carica e valida i cani selezionati per un dato proprietario, calcola il prezzo
 * e costruisce la mappa cani. Condiviso tra creazione utente e gestionale.
 */
export async function loadAndPricePensioneBooking(args: {
  userId: string;
  input: SavePensioneBookingInput;
  daysCount: number;
  enforcePetRequirements: boolean;
}): Promise<{ dogMap: Map<string, DogLite>; pricing: ReturnType<typeof computePricing>; ownedDogRows: OwnedDogRow[] }> {
  const { userId, input, daysCount, enforcePetRequirements } = args;

  const { data: ownedDogs, error: dogsError } = await supabaseAdmin
    .from('dogs')
    .select('id, owner_id, name, species, microchip, birth_date, libretto_name, size_category, grooming_difficulty')
    .in('id', input.selectedDogIds)
    .eq('owner_id', userId)
    .eq('is_active', true);

  if (dogsError) {
    throw new PensioneBookingError('Errore caricando i pet selezionati.');
  }

  const ownedDogRows = (ownedDogs ?? []) as OwnedDogRow[];
  if (ownedDogRows.length !== input.selectedDogIds.length) {
    throw new PensioneBookingError('Uno o più pet selezionati non sono validi.');
  }

  if (enforcePetRequirements) {
    for (const dog of ownedDogRows) {
      const petMissing = getMissingRequiredPetBookingFields({
        name: dog.name,
        species: dog.species,
        birth_date: dog.birth_date,
        microchip: dog.microchip,
        libretto_name: dog.libretto_name,
      });
      if (petMissing.length > 0) {
        throw new PensioneBookingError(
          `Completa i dati di ${dog.name} per prenotare: ${petMissing.join(', ')}.`
        );
      }
    }
  }

  // Alloggio coerente con la specie (cane: no gattile; gatto: solo gattile; altro: non prenotabile).
  for (const dog of ownedDogRows) {
    const species = dog.species ?? 'DOG';
    const allowed = accommodationOptionsForSpecies(species);
    const chosen = input.perDogForm[dog.id]?.accommodationType;
    if (allowed.length === 0) {
      throw new PensioneBookingError(`${dog.name} non è prenotabile in pensione.`);
    }
    if (chosen && !allowed.includes(chosen)) {
      throw new PensioneBookingError(`Alloggio non valido per ${dog.name}.`);
    }
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
    taxiOption: input.taxiOption as TaxiOption,
    taxiDistanceBand: (input.taxiDistanceBand ?? DEFAULT_TAXI.distanceBand) as TaxiDistanceBand,
  });

  if (pricing.totalPrice <= 0) {
    throw new PensioneBookingError('Impossibile calcolare il prezzo.');
  }

  return { dogMap, pricing, ownedDogRows };
}

/**
 * Crea una nuova prenotazione pensione per conto di `userId`.
 * Non esegue i controlli requisiti profilo/documento (specifici del flusso utente):
 * il chiamante li gestisce prima, se necessari. I blocchi pensione NON sono
 * verificati qui (lo staff li bypassa; il flusso utente li controlla a monte).
 */
export async function createPensioneBooking(args: {
  userId: string;
  input: SavePensioneBookingInput;
  status: BookingStatus;
  enforcePetRequirements: boolean;
}): Promise<{ bookingId: string; ownerName: string; dogsLabel: string }> {
  const { userId, input, status, enforcePetRequirements } = args;

  if (input.endDate < input.startDate) {
    throw new PensioneBookingError(
      'La data di partenza deve essere uguale o successiva alla data di arrivo.'
    );
  }

  const arrivalError = validateTimeWindow('L’orario di arrivo', input.arrivalTime, input.startDate);
  if (arrivalError) throw new PensioneBookingError(arrivalError);

  const departureError = validateTimeWindow('L’orario di partenza', input.departureTime, input.endDate);
  if (departureError) throw new PensioneBookingError(departureError);

  const daysCount = computeDaysCount(input.startDate, input.endDate, input.departureTime);
  if (daysCount <= 0) throw new PensioneBookingError('Date prenotazione non valide.');

  const { dogMap, pricing, ownedDogRows } = await loadAndPricePensioneBooking({
    userId,
    input,
    daysCount,
    enforcePetRequirements,
  });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();

  const ownerName = formatPersonName(
    (profile as { first_name?: string | null } | null)?.first_name ?? null,
    (profile as { last_name?: string | null } | null)?.last_name ?? null
  );
  const dogsLabel =
    ownedDogRows.length === 1 ? ownedDogRows[0]?.name ?? '1 cane' : `${ownedDogRows.length} cani`;

  const bookingPayload = buildBookingPayload({
    firstDogId: input.selectedDogIds[0],
    input,
    pricing,
  });

  const { data: bookingInsert, error: bookingInsertError } = await supabaseAdmin
    .from('bookings')
    .insert({
      user_id: userId,
      status,
      ...bookingPayload,
    })
    .select('id')
    .single();

  if (bookingInsertError || !bookingInsert?.id) {
    throw new PensioneBookingError('Errore nel salvataggio della prenotazione.');
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
    throw new PensioneBookingError(
      'La prenotazione principale è stata salvata, ma il dettaglio per cane non è andato a buon fine.',
      500
    );
  }

  return { bookingId, ownerName, dogsLabel };
}
