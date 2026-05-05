// lib/services/serviceCalendarApi.ts

import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';
import {
  getServiceSlotDogIds,
  loadServiceSlotDogSummaryMap,
  mapServiceSlotDogs,
  type ServiceSlotDogSummary,
} from '@/lib/services/serviceSlotDogs';
import type { ServiceSlotRow, ServiceSlotBookingRow, ServiceType, ServiceVariant } from '@/types/services';

type ServiceSlotForBooking = Pick<
  ServiceSlotRow,
  'id' | 'start_at' | 'end_at' | 'service_type' | 'service_variant'
>;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

type ServiceSlotBookingQueryRow = Omit<ServiceSlotBookingRow, 'service_type' | 'service_variant'> & {
  dog_id: string | null;
  service_type: ServiceType | null;
  service_variant: ServiceVariant | null;
  service_slots: ServiceSlotForBooking | ServiceSlotForBooking[] | null;
};

export type ServiceSlotBookingWithRelations = ServiceSlotBookingRow & {
  dogs: ServiceSlotDogSummary[];
  service_slots: ServiceSlotForBooking | null;
};

export type ServiceSlotWithRemainingRow = ServiceSlotRow & { remaining_capacity: number };

export async function getUserServiceSlotBookingsInRange(args: {
  userId: string;
  startIso: string;
  endIso: string;
}): Promise<ServiceSlotBookingWithRelations[]> {
  const { userId, startIso, endIso } = args;

  const { data, error } = await supabase
    .from('service_slot_bookings')
    .select(
      `
      id,
      user_id,
      slot_id,
      dog_id,
      dog_ids,
      pass_id,
      credits_spent,
      taxi_enabled,
      taxi_distance_km,
      taxi_price_eur,
      total_price,
      status,
      notes,
      created_at,
      service_type,
      service_variant,
      service_slots!inner (
        id,
        start_at,
        end_at,
        service_type,
        service_variant
      )
    `
    )
    .eq('user_id', userId)
    .in('status', ['CONFIRMED', 'PAID']) // ✅ niente cancellati sul calendario
    .gte('service_slots.start_at', startIso)
    .lt('service_slots.start_at', endIso)
    .order('start_at', { ascending: true, referencedTable: 'service_slots' });

  if (error) throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a caricare le prenotazioni dei servizi.'));

  const queryRows = (data ?? []) as ServiceSlotBookingQueryRow[];

  const normalizedRows = queryRows.map((row) => {
    const slot = firstRelation(row.service_slots);
    const serviceType = row.service_type ?? slot?.service_type;
    if (!serviceType) {
      throw new Error('service_type mancante nel caricamento prenotazioni slot.');
    }

    const dogIds = getServiceSlotDogIds(row);

    return {
      id: row.id,
      user_id: row.user_id,
      slot_id: row.slot_id,
      dog_ids: dogIds.length > 0 ? dogIds : null,
      pass_id: row.pass_id,
      credits_spent: row.credits_spent,
      taxi_enabled: row.taxi_enabled,
      taxi_distance_km: row.taxi_distance_km,
      taxi_price_eur: row.taxi_price_eur,
      total_price: row.total_price,
      status: row.status,
      notes: row.notes,
      created_at: row.created_at,
      service_type: serviceType,
      service_variant: row.service_variant ?? slot?.service_variant ?? null,
      service_slots: slot,
      dogs: [] as ServiceSlotDogSummary[],
    };
  });

  const dogMap = await loadServiceSlotDogSummaryMap(normalizedRows);

  return normalizedRows.map((row) => ({
    ...row,
    dogs: mapServiceSlotDogs(row, dogMap),
  }));
}

/**
 * Usa la VIEW `service_slots_with_remaining` e filtra remaining_capacity > 0
 * così gli slot pieni non compaiono proprio.
 */
export async function getAvailableServiceSlotsInRange(args: {
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;
  startIso: string;
  endIso: string;
}): Promise<ServiceSlotWithRemainingRow[]> {
  const { serviceType, serviceVariant, startIso, endIso } = args;

  let q = supabase
    .from('service_slots_with_remaining')
    .select('*')
    .eq('service_type', serviceType)
    .eq('is_active', true)
    .gt('remaining_capacity', 0)
    .gte('start_at', startIso)
    .lt('start_at', endIso)
    .order('start_at', { ascending: true });

  if (serviceVariant === null) q = q.is('service_variant', null);
  else q = q.eq('service_variant', serviceVariant);

  const { data, error } = await q;
  if (error) throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a caricare gli slot disponibili.'));

  return (data ?? []) as ServiceSlotWithRemainingRow[];
}

export async function bookServiceSlotAtomic(args: {
  slotId: string;
  passId: string | null;
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;
  dogIds: string[] | null;
  creditsSpent: number;
  taxiEnabled: boolean;
  taxiDistanceKm: number | null;
  taxiPriceEur: number | null;
  notes?: string | null;
}): Promise<string> {
  const {
    slotId,
    passId,
    serviceType,
    serviceVariant,
    dogIds,
    creditsSpent,
    taxiEnabled,
    taxiDistanceKm,
    taxiPriceEur,
    notes = null,
  } = args;

  const response = await fetch('/api/service-slot-bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({
      slotId,
      passId,
      serviceType,
      serviceVariant,
      dogIds,
      creditsSpent,
      taxiEnabled,
      taxiDistanceKm,
      taxiPriceEur,
      notes,
    }),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((json) => String((json as { error?: string }).error ?? '').trim())
      .catch(() => '');

    throw new Error(message || 'Errore durante la prenotazione dello slot.');
  }

  const data = (await response.json()) as { bookingId?: string };

  if (!data.bookingId) {
    throw new Error('Prenotazione slot non valida.');
  }

  return data.bookingId;
}

export async function cancelServiceSlotBooking(args: { bookingId: string }): Promise<void> {
  const { bookingId } = args;

  const response = await fetch('/api/service-slot-bookings', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ bookingId }),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((json) => String((json as { error?: string }).error ?? '').trim())
      .catch(() => '');

    throw new Error(message || 'Errore durante la cancellazione dello slot.');
  }
}
