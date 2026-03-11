// lib/services/serviceCalendarApi.ts

import { supabase } from '@/lib/supabaseClient';
import type { ServiceSlotRow, ServiceSlotBookingRow, ServiceType, ServiceVariant } from '@/types/services';

type ServiceSlotDogSummary = {
  id: string;
  name: string | null;
  breed: string | null;
};

type ServiceSlotForBooking = Pick<
  ServiceSlotRow,
  'id' | 'start_at' | 'end_at' | 'service_type' | 'service_variant'
>;

type ServiceSlotBookingQueryRow = Omit<ServiceSlotBookingRow, 'service_type' | 'service_variant'> & {
  service_type: ServiceType | null;
  service_variant: ServiceVariant | null;
  dogs: ServiceSlotDogSummary | null;
  service_slots: ServiceSlotForBooking | null;
};

export type ServiceSlotBookingWithRelations = ServiceSlotBookingRow & {
  dogs: ServiceSlotDogSummary | null;
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
      *,
      dogs:dog_id (
        id,
        name,
        breed
      ),
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

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as ServiceSlotBookingQueryRow[]).map((row) => {
    const serviceType = row.service_type ?? row.service_slots?.service_type;
    if (!serviceType) {
      throw new Error('service_type mancante nel caricamento prenotazioni slot.');
    }

    return {
      ...row,
      service_type: serviceType,
      service_variant: row.service_variant ?? row.service_slots?.service_variant ?? null,
    };
  });

  return rows;
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
  if (error) throw new Error(error.message);

  return (data ?? []) as ServiceSlotWithRemainingRow[];
}

export async function bookServiceSlotAtomic(args: {
  userId: string;
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
    userId,
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

  const { data, error } = await supabase.rpc('book_service_slot', {
    p_user_id: userId,
    p_slot_id: slotId,
    p_pass_id: passId,
    p_service_type: serviceType,
    p_service_variant: serviceVariant,
    p_dog_ids: dogIds,
    p_credits_spent: creditsSpent,
    p_taxi_enabled: taxiEnabled,
    p_taxi_distance_km: taxiDistanceKm,
    p_taxi_price_eur: taxiPriceEur,
    p_notes: notes,
  });

  if (error) throw new Error(error.message);

  return data as string;
}

export async function cancelServiceSlotBooking(args: { userId: string; bookingId: string }): Promise<void> {
  const { userId, bookingId } = args;

  const { error } = await supabase.rpc('cancel_service_slot_booking', {
    p_user_id: userId,
    p_booking_id: bookingId,
  });

  if (error) throw new Error(error.message);
}
