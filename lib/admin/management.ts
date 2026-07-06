// Operazioni di scrittura "gestionale completo": creazione/eliminazione utenti,
// gestione cani, edit completo prenotazioni (pensione + slot), crediti/pacchetti.
// Tutte via supabaseAdmin (service role, bypassa RLS). Le rotte chiamanti devono
// sempre passare da requireStaffAccess(request, 'manage').
import { resolveDogBreedProfile } from '@/data/petBreeds';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { purgeUserAccount } from '@/lib/account/deleteAccount';
import {
  buildExtrasPayload,
  computeDaysCount,
  computePerDogTotals,
  computePricing,
} from '@/lib/services/pensione/utils';
import { DEFAULT_TAXI } from '@/lib/services/pensione/constants';
import type { SavePensioneBookingInput } from '@/lib/services/pensione/api';
import type { DogLite } from '@/lib/services/pensione/types';
import type { AdminServiceKey } from '@/lib/admin/types';
import type { BookingStatus } from '@/types/booking';
import type { Dog, DogInput } from '@/types/dog';
import type { Profile } from '@/types/profile';
import type { ServicePassRow, ServiceStatus, ServiceType, ServiceVariant } from '@/types/services';

const DOG_SELECT =
  'id, owner_id, created_at, updated_at, species, species_other, libretto_name, name, breed, size_category, grooming_difficulty, sex, microchip, birth_date, notes, coat_color, temperament, photo_path, is_active, public_id, show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes, show_coat_color, show_temperament, weight_kg, origin_breeds, show_weight, show_origin_breeds';
const PASS_SELECT =
  'id, user_id, service_type, service_variant, product_id, credits_total, credits_used, status, purchased_at, expires_at, unlocked_at, unlocked_by';
const PROFILE_RETURN_SELECT =
  'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, id_document_back_path, id_document_back_uploaded_at, wallet_due_eur, deleted_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';

/** Debito ancora in sospeso nel saldo: confermato ma non pagato. */
function isOutstandingBalanceStatus(status: BookingStatus | ServiceStatus | null | undefined): boolean {
  return status === 'CONFIRMED' || status === 'COMPLETED';
}

async function addWalletDue(userId: string, amountEur: number): Promise<void> {
  if (!Number.isFinite(amountEur) || amountEur === 0) return;
  const { error } = await supabaseAdmin.rpc('add_wallet_due', {
    p_user_id: userId,
    p_amount_eur: amountEur,
  });
  if (error) throw new Error(error.message);
}

// ──────────────────────────────────────────────────────────────────────────
// Utenti: creazione, soft-delete, ripristino, hard-delete
// ──────────────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  // Password temporanea leggibile da comunicare al cliente.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `Tdb-${out}`;
}

export async function createAdminUser(args: {
  email: string;
  password?: string | null;
  profile: Partial<Profile>;
}): Promise<{ userId: string; profile: Profile; tempPassword: string | null }> {
  const { email, profile } = args;
  const password = args.password && args.password.length >= 8 ? args.password : generateTempPassword();
  const generated = !args.password || args.password.length < 8;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data?.user) {
    throw new Error(error?.message ?? 'Impossibile creare l’account utente.');
  }

  const userId = data.user.id;

  // Il trigger handle_new_user crea la riga profiles; aggiorniamo l'anagrafica.
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ ...profile, user_id: userId, email, deleted_at: null }, { onConflict: 'user_id' })
    .select(PROFILE_RETURN_SELECT)
    .single();

  if (profileError || !profileData) {
    // Rollback dell'account auth se il profilo non va a buon fine.
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(profileError?.message ?? 'Impossibile salvare il profilo del nuovo utente.');
  }

  return { userId, profile: profileData as Profile, tempPassword: generated ? password : null };
}

export async function setAdminUserDeleted(userId: string, deleted: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  // Blocca/sblocca l'accesso all'app per l'utente soft-deleted.
  await supabaseAdmin.auth.admin
    .updateUserById(userId, { ban_duration: deleted ? '876000h' : 'none' })
    .catch(() => undefined);
}

export async function hardDeleteAdminUser(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('user_id, deleted_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) throw new Error('Utente non trovato.');
  if (!(profile as { deleted_at?: string | null }).deleted_at) {
    throw new Error('Prima di eliminare definitivamente, sposta l’utente tra gli eliminati (soft-delete).');
  }

  await purgeUserAccount(userId);
}

// ──────────────────────────────────────────────────────────────────────────
// Cani: creazione / eliminazione (size derivata dalla razza, come lato utente)
// ──────────────────────────────────────────────────────────────────────────

export async function createAdminDog(ownerId: string, input: DogInput): Promise<Dog> {
  // Il gestionale è autoritativo: si tiene la taglia/difficoltà scelte dallo staff (incluso
  // l'override per i meticci); si deriva dalla razza solo come fallback se mancano.
  const breedProfile = resolveDogBreedProfile(input.species, input.breed, input.origin_breeds);
  const payload = {
    ...input,
    owner_id: ownerId,
    size_category: input.species === 'OTHER' ? input.size_category : input.size_category ?? breedProfile?.size ?? null,
    grooming_difficulty:
      input.species === 'OTHER' ? input.grooming_difficulty : input.grooming_difficulty ?? breedProfile?.washDifficulty ?? null,
  };

  const { data, error } = await supabaseAdmin.from('dogs').insert(payload).select(DOG_SELECT).single();
  if (error || !data) throw new Error(error?.message ?? 'Impossibile creare il cane.');
  return data as Dog;
}

export async function deleteAdminDog(dogId: string): Promise<void> {
  // Soft-delete coerente col flusso utente: preserva lo storico prenotazioni.
  const { data, error } = await supabaseAdmin
    .from('dogs')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', dogId)
    .eq('is_active', true)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Cane non trovato.');
}

// ──────────────────────────────────────────────────────────────────────────
// Crediti / pacchetti
// ──────────────────────────────────────────────────────────────────────────

type ServiceProductRow = {
  id: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
  name: string;
  credits: number;
  price_eur: number;
  is_active: boolean;
};

export type AdminServiceProduct = {
  id: string;
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;
  name: string;
  credits: number;
  priceEur: number;
};

export async function listAdminServiceProducts(): Promise<AdminServiceProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('service_products')
    .select('id, service_type, service_variant, name, credits, price_eur, is_active')
    .eq('is_active', true)
    .order('service_type', { ascending: true })
    .order('credits', { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as ServiceProductRow[]).map((row) => ({
    id: row.id,
    serviceType: row.service_type,
    serviceVariant: row.service_variant ?? null,
    name: row.name,
    credits: row.credits,
    priceEur: Number(row.price_eur ?? 0),
  }));
}

/**
 * Assegna un pacchetto/credito per conto del cliente, replicando la logica di
 * purchase_service_pass: il prezzo entra nel saldo; i pacchetti multi-credito di
 * ASILO/ADDESTRAMENTO/CONSULENZA nascono LOCKED finché lo staff non conferma il pagamento.
 */
export async function assignAdminServicePass(args: {
  userId: string;
  productId: string;
}): Promise<ServicePassRow> {
  const { userId, productId } = args;

  const { data: product, error: productError } = await supabaseAdmin
    .from('service_products')
    .select('id, service_type, service_variant, name, credits, price_eur, is_active')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (productError) throw new Error(productError.message);
  if (!product) throw new Error('Prodotto non trovato o non attivo.');

  const row = product as ServiceProductRow;
  const isMultiCreditLockable =
    (row.service_type === 'ASILO' || row.service_type === 'ADDESTRAMENTO' || row.service_type === 'CONSULENZA') &&
    Number(row.credits ?? 0) > 1;
  const status = isMultiCreditLockable ? 'LOCKED' : 'ACTIVE';
  const now = new Date().toISOString();

  const { data: pass, error: passError } = await supabaseAdmin
    .from('service_passes')
    .insert({
      user_id: userId,
      service_type: row.service_type,
      service_variant: row.service_variant,
      product_id: row.id,
      credits_total: row.credits,
      credits_used: 0,
      status,
      unlocked_at: status === 'ACTIVE' ? now : null,
    })
    .select(PASS_SELECT)
    .single();

  if (passError || !pass) throw new Error(passError?.message ?? 'Impossibile assegnare il pacchetto.');

  await addWalletDue(userId, Number(row.price_eur ?? 0));

  return pass as ServicePassRow;
}

export async function removeAdminServicePass(args: { userId: string; passId: string }): Promise<void> {
  const { userId, passId } = args;
  const { data, error } = await supabaseAdmin
    .from('service_passes')
    .update({ status: 'CANCELLED' })
    .eq('id', passId)
    .eq('user_id', userId)
    .neq('status', 'CANCELLED')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Pacchetto non trovato o già annullato.');
}

// ──────────────────────────────────────────────────────────────────────────
// Edit COMPLETO prenotazione PENSIONE (qualsiasi user_id)
// ──────────────────────────────────────────────────────────────────────────

type OwnedDogRow = {
  id: string;
  owner_id: string;
  name: string;
  size_category: DogLite['size_category'];
  grooming_difficulty: DogLite['grooming_difficulty'];
};

export type AdminPensioneEditResult = {
  userId: string;
  previousTotal: number;
  newTotal: number;
  walletDelta: number;
  walletApplied: boolean;
};

export async function updateAdminPensioneBookingFull(
  bookingId: string,
  input: SavePensioneBookingInput
): Promise<AdminPensioneEditResult> {
  if (input.endDate < input.startDate) {
    throw new Error('La data di partenza deve essere uguale o successiva alla data di arrivo.');
  }

  const daysCount = computeDaysCount(input.startDate, input.endDate, input.departureTime);
  if (daysCount <= 0) throw new Error('Date prenotazione non valide.');

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, service_type, status, total_price')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) throw new Error(bookingError.message);
  if (!booking || booking.service_type !== 'PENSIONE') throw new Error('Prenotazione non trovata.');

  const userId = String(booking.user_id);
  const previousStatus = booking.status as BookingStatus | null;
  const previousTotal = Number(booking.total_price ?? 0);

  const { data: ownedDogs, error: dogsError } = await supabaseAdmin
    .from('dogs')
    .select('id, owner_id, name, size_category, grooming_difficulty')
    .in('id', input.selectedDogIds)
    .eq('owner_id', userId)
    .eq('is_active', true);

  if (dogsError) throw new Error('Errore caricando i cani selezionati.');

  const ownedDogRows = (ownedDogs ?? []) as OwnedDogRow[];
  if (ownedDogRows.length !== input.selectedDogIds.length) {
    throw new Error('Uno o più cani selezionati non appartengono al cliente o non sono attivi.');
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

  if (pricing.totalPrice <= 0) throw new Error('Impossibile calcolare il prezzo.');

  const taxiPickupTime =
    input.taxiOption === 'ONE_WAY' || input.taxiOption === 'ROUND_TRIP' ? input.arrivalTime : null;
  const taxiReturnTime =
    input.taxiOption === 'RETURN_ONLY' || input.taxiOption === 'ROUND_TRIP' ? input.departureTime : null;

  const bookingPayload = {
    dog_id: input.selectedDogIds[0],
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

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update(bookingPayload)
    .eq('id', bookingId);
  if (updateError) throw new Error(updateError.message);

  await supabaseAdmin.from('booking_dogs').delete().eq('booking_id', bookingId);

  const bookingDogsPayload = input.selectedDogIds.map((dogId) => {
    const dog = dogMap.get(dogId)!;
    const form = input.perDogForm[dogId];
    const totals = computePerDogTotals({ dog, form, daysCount, totalDogs: input.selectedDogIds.length });
    return {
      booking_id: bookingId,
      dog_id: dogId,
      accommodation_type: form.accommodationType,
      accommodation_price_per_day: totals.accommodation_price_per_day,
      days_count: daysCount,
      accommodation_subtotal: totals.accommodation_subtotal,
      extras: buildExtrasPayload(form),
      extras_subtotal: totals.extras_subtotal,
      per_dog_total: totals.per_dog_total,
    };
  });

  const { error: insertError } = await supabaseAdmin.from('booking_dogs').insert(bookingDogsPayload);
  if (insertError) throw new Error(insertError.message);

  // Riconciliazione saldo: solo se la prenotazione è "a saldo" (CONFIRMED/COMPLETED).
  const walletApplied = isOutstandingBalanceStatus(previousStatus);
  const walletDelta = walletApplied ? pricing.totalPrice - previousTotal : 0;
  if (walletDelta !== 0) {
    await addWalletDue(userId, walletDelta);
  }

  return {
    userId,
    previousTotal,
    newTotal: pricing.totalPrice,
    walletDelta,
    walletApplied,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Edit prenotazione SLOT (asilo/addestramento/consulenza/taxi)
// Modifica slot, cane, taxi e note di una singola riga, con controllo capienza.
// ──────────────────────────────────────────────────────────────────────────

export type AdminSlotEditInput = {
  slotId?: string | null;
  dogId?: string | null;
  taxiEnabled?: boolean;
  taxiDistanceKm?: number | null;
  taxiPriceEur?: number | null;
  notes?: string | null;
};

export type AdminSlotEditResult = {
  userId: string;
  walletDelta: number;
};

export async function updateAdminSlotBookingFull(
  bookingId: string,
  input: AdminSlotEditInput
): Promise<AdminSlotEditResult> {
  const { data: booking, error } = await supabaseAdmin
    .from('service_slot_bookings')
    .select('id, user_id, slot_id, dog_id, service_type, status, taxi_enabled, taxi_price_eur, taxi_distance_km')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!booking) throw new Error('Prenotazione non trovata.');

  const userId = String(booking.user_id);
  const nextSlotId = input.slotId ?? booking.slot_id;

  // Controllo capienza se cambia lo slot.
  if (nextSlotId !== booking.slot_id) {
    const { data: slot } = await supabaseAdmin
      .from('service_slots')
      .select('id, capacity, is_active, service_type')
      .eq('id', nextSlotId)
      .maybeSingle();
    if (!slot || slot.is_active === false) throw new Error('Slot non trovato o non attivo.');
    if (booking.service_type && slot.service_type && booking.service_type !== slot.service_type) {
      throw new Error('Lo slot selezionato è di un servizio diverso.');
    }

    const { count } = await supabaseAdmin
      .from('service_slot_bookings')
      .select('id', { head: true, count: 'exact' })
      .eq('slot_id', nextSlotId)
      .in('status', ['CONFIRMED', 'PAID']);
    if ((count ?? 0) >= Number(slot.capacity ?? 0)) {
      throw new Error('Lo slot selezionato è al completo.');
    }
  }

  const wasTaxi = Boolean(booking.taxi_enabled);
  const oldTaxiPrice = wasTaxi ? Number(booking.taxi_price_eur ?? 0) : 0;
  const nextTaxiEnabled = input.taxiEnabled ?? wasTaxi;
  const nextTaxiPrice = nextTaxiEnabled ? Number(input.taxiPriceEur ?? booking.taxi_price_eur ?? 0) : 0;

  const patch: Record<string, unknown> = {
    slot_id: nextSlotId,
    notes: input.notes !== undefined ? (input.notes?.trim() ? input.notes.trim() : null) : undefined,
    taxi_enabled: nextTaxiEnabled,
    taxi_distance_km: nextTaxiEnabled ? input.taxiDistanceKm ?? booking.taxi_distance_km ?? null : null,
    taxi_price_eur: nextTaxiPrice,
  };
  if (input.dogId !== undefined && input.dogId !== null) patch.dog_id = input.dogId;
  // rimuove le chiavi undefined
  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) delete patch[key];
  }

  const { error: updateError } = await supabaseAdmin
    .from('service_slot_bookings')
    .update(patch)
    .eq('id', bookingId);
  if (updateError) throw new Error(updateError.message);

  // Riconciliazione taxi nel saldo solo se la prenotazione è attiva (non annullata).
  let walletDelta = 0;
  if (booking.status !== 'CANCELLED') {
    walletDelta = nextTaxiPrice - oldTaxiPrice;
    if (walletDelta !== 0) await addWalletDue(userId, walletDelta);
  }

  return { userId, walletDelta };
}

// ──────────────────────────────────────────────────────────────────────────
// Fix gap §2.1: annullo/riattivazione admin di uno SLOT con rimborso/riaddebito
// crediti + taxi. Da usare al posto del semplice updateAdminBookingStatus per gli slot.
// ──────────────────────────────────────────────────────────────────────────

export async function updateAdminSlotBookingStatus(args: {
  bookingId: string;
  status: BookingStatus | ServiceStatus;
}): Promise<{ userId: string; serviceType: string; previousStatus: string | null; status: string }> {
  const { bookingId, status } = args;

  const { data: current, error } = await supabaseAdmin
    .from('service_slot_bookings')
    .select('user_id, service_type, status, pass_id, credits_spent, taxi_enabled, taxi_price_eur')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!current) throw new Error('Prenotazione non trovata.');

  const previousStatus = current.status as ServiceStatus | null;
  const userId = String(current.user_id);
  const wasActive = previousStatus !== 'CANCELLED';
  const willBeActive = status !== 'CANCELLED';

  const { error: updateError } = await supabaseAdmin
    .from('service_slot_bookings')
    .update({ status })
    .eq('id', bookingId);
  if (updateError) throw new Error(updateError.message);

  const passId = (current as { pass_id?: string | null }).pass_id ?? null;
  const creditsSpent = Number((current as { credits_spent?: number | null }).credits_spent ?? 0);
  const taxiEnabled = Boolean((current as { taxi_enabled?: boolean | null }).taxi_enabled);
  const taxiPrice = Number((current as { taxi_price_eur?: number | null }).taxi_price_eur ?? 0);

  // attivo → annullato: rimborsa credito e togli taxi dal saldo.
  if (wasActive && !willBeActive) {
    if (passId && creditsSpent > 0) {
      const { data: pass } = await supabaseAdmin
        .from('service_passes')
        .select('credits_total, credits_used')
        .eq('id', passId)
        .maybeSingle();
      if (pass) {
        const nextUsed = Math.max(0, Number(pass.credits_used ?? 0) - creditsSpent);
        const reactivated = nextUsed < Number(pass.credits_total ?? 0);
        await supabaseAdmin
          .from('service_passes')
          .update(reactivated ? { credits_used: nextUsed, status: 'ACTIVE' } : { credits_used: nextUsed })
          .eq('id', passId);
      }
    }
    if (taxiEnabled && taxiPrice > 0) await addWalletDue(userId, -taxiPrice);
  }

  // annullato → attivo: riaddebita credito e rimetti taxi nel saldo.
  if (!wasActive && willBeActive) {
    if (passId && creditsSpent > 0) {
      const { data: pass } = await supabaseAdmin
        .from('service_passes')
        .select('credits_total, credits_used, status')
        .eq('id', passId)
        .maybeSingle();
      if (pass) {
        const nextUsed = Number(pass.credits_used ?? 0) + creditsSpent;
        const consumed = nextUsed >= Number(pass.credits_total ?? 0);
        await supabaseAdmin
          .from('service_passes')
          .update(consumed ? { credits_used: nextUsed, status: 'CONSUMED' } : { credits_used: nextUsed, status: 'ACTIVE' })
          .eq('id', passId);
      }
    }
    if (taxiEnabled && taxiPrice > 0) await addWalletDue(userId, taxiPrice);
  }

  return {
    userId,
    serviceType: String(current.service_type ?? ''),
    previousStatus: previousStatus ? String(previousStatus) : null,
    status: String(status),
  };
}

// Etichetta servizio compatta riutilizzabile (per messaggi/notifiche).
export function adminServiceKeyFromType(serviceType: ServiceType | null | undefined): AdminServiceKey {
  return (serviceType ?? 'CONSULENZA') as AdminServiceKey;
}
