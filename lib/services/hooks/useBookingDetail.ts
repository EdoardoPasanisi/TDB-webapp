// FILE: lib/services/hooks/useBookingDetail.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';
import {
  loadServiceSlotDogSummaryMap,
  mapServiceSlotDogs,
  type ServiceSlotDogSummary,
} from '@/lib/services/serviceSlotDogs';
import type { BookingDogRow, BookingRow, BookingStatus } from '@/types/booking';
import type { ServiceType as SlotServiceType, ServiceVariant } from '@/types/services';

type Status = 'idle' | 'loading' | 'success' | 'error';

type DogMini = ServiceSlotDogSummary;
export type BookingDogDetailRow = BookingDogRow & { dogName: string; dogBreed: string | null };

type BookingQueryRow = BookingRow;
type BookingDogQueryRow = BookingDogRow & {
  extras: BookingDogRow['extras'] | null;
  dogs: DogMini[] | DogMini | null;
};
type ServiceSlotRowRelation = {
  id: string;
  start_at: string;
  end_at: string;
  service_type: SlotServiceType;
  service_variant: ServiceVariant | null;
};
type ServiceSlotBookingQueryRow = {
  id: string;
  user_id: string;
  slot_id: string | null;
  service_type: SlotServiceType | null;
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

export type ServiceSlotBookingDetail = {
  rep_id: string;
  slot_id: string;

  user_id: string;
  service_type: SlotServiceType;
  service_variant: ServiceVariant | null;

  status: BookingStatus | null;

  notes: string | null;
  start_at: string;
  end_at: string;

  dogs: DogMini[];

  taxi_enabled: boolean;
  taxi_distance_km: number | null;
  taxi_price_eur: number | null;

  credits_spent: number;
  total_price: number | null;

  booking_ids: string[];

  created_at?: string;
};

export type BookingDetailData =
  | {
      kind: 'PENSIONE';
      booking: BookingRow;
      bookingDogs: BookingDogDetailRow[];
    }
  | {
      kind: 'SERVICE_SLOT';
      slotBooking: ServiceSlotBookingDetail;
    };

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

function normalizeBookingRow(raw: BookingQueryRow): BookingRow {
  return {
    id: raw.id,
    user_id: raw.user_id,
    dog_id: raw.dog_id ?? null,

    service_type: raw.service_type as BookingRow['service_type'],

    start_date: raw.start_date,
    end_date: raw.end_date ?? null,

    arrival_time: raw.arrival_time ?? null,
    departure_time: raw.departure_time ?? null,

    notes: raw.notes ?? null,

    status: raw.status as BookingStatus | null,
    dogs_count: raw.dogs_count ?? null,

    taxi_option: raw.taxi_option ?? null,
    taxi_distance_band: raw.taxi_distance_band ?? null,
    taxi_price: raw.taxi_price ?? null,
    taxi_pickup_time: raw.taxi_pickup_time ?? null,
    taxi_return_time: raw.taxi_return_time ?? null,

    alloggio_total_full: raw.alloggio_total_full ?? null,
    alloggio_discount_percent: raw.alloggio_discount_percent ?? null,
    alloggio_total_discounted: raw.alloggio_total_discounted ?? null,
    extras_total: raw.extras_total ?? null,
    total_price: raw.total_price ?? null,

    stripe_session_id: raw.stripe_session_id ?? null,
    total_amount_cents: raw.total_amount_cents ?? null,

    created_at: raw.created_at ?? undefined,
    updated_at: raw.updated_at ?? undefined,
  };
}

function normalizeBookingDogRow(raw: BookingDogQueryRow): BookingDogRow {
  return {
    id: raw.id,
    booking_id: raw.booking_id,
    dog_id: raw.dog_id,

    accommodation_type: raw.accommodation_type,
    accommodation_price_per_day: raw.accommodation_price_per_day ?? 0,
    days_count: raw.days_count ?? 0,

    accommodation_subtotal: raw.accommodation_subtotal ?? 0,
    extras: raw.extras ?? {},
    extras_subtotal: raw.extras_subtotal ?? 0,
    per_dog_total: raw.per_dog_total ?? 0,

    created_at: raw.created_at ?? undefined,
    updated_at: raw.updated_at ?? undefined,
  };
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

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function useBookingDetail(userId: string | undefined, bookingId: string | undefined) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetailData | null>(null);

  const requestSeqRef = useRef(0);
  const loading = status === 'loading';

  const refresh = useCallback(async () => {
    if (!userId || !bookingId) {
      setStatus('idle');
      setError(null);
      setDetail(null);
      return;
    }

    const mySeq = ++requestSeqRef.current;

    setStatus('loading');
    setError(null);
    setDetail(null);

    try {
      // 1) Prova come “Pensione”
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(
          `
          id,
          user_id,
          dog_id,
          service_type,
          start_date,
          end_date,
          arrival_time,
          departure_time,
          notes,
          status,
          dogs_count,
          taxi_option,
          taxi_distance_band,
          taxi_price,
          taxi_pickup_time,
          taxi_return_time,
          alloggio_total_full,
          alloggio_discount_percent,
          alloggio_total_discounted,
          extras_total,
          total_price,
          stripe_session_id,
          total_amount_cents,
          created_at,
          updated_at
        `,
        )
        .eq('id', bookingId)
        .maybeSingle();

      if (requestSeqRef.current !== mySeq) return;

      if (bookingError) throw new Error(`Errore Supabase (bookings): ${bookingError.message}`);

      const normalizedBookingData = (bookingData ?? null) as BookingQueryRow | null;
      if (normalizedBookingData) {
        const normalizedBooking = normalizeBookingRow(normalizedBookingData);
        if (normalizedBooking.user_id !== userId) throw new Error('Prenotazione non trovata.');

        const { data: bookingDogsData, error: bookingDogsError } = await supabase
          .from('booking_dogs')
          .select(
            `
            id,
            booking_id,
            dog_id,
            accommodation_type,
            accommodation_price_per_day,
            days_count,
            accommodation_subtotal,
            extras,
            extras_subtotal,
            per_dog_total,
            dogs:dog_id ( id, name, breed )
          `,
          )
          .eq('booking_id', bookingId);

        if (requestSeqRef.current !== mySeq) return;

        if (bookingDogsError) throw new Error(`Errore Supabase (booking_dogs): ${bookingDogsError.message}`);

        const bookingDogsRows = (bookingDogsData ?? []) as BookingDogQueryRow[];
        const bookingDogs: BookingDogDetailRow[] = bookingDogsRows.map((raw) => {
          const dog = Array.isArray(raw.dogs) ? raw.dogs[0] ?? null : raw.dogs;
          return {
            ...normalizeBookingDogRow(raw),
            dogName: dog?.name ?? '',
            dogBreed: dog?.breed ?? null,
          };
        });

        setDetail({
          kind: 'PENSIONE',
          booking: normalizedBooking,
          bookingDogs,
        });
        setStatus('success');
        return;
      }

      // 2) Slot-based.
      // ✅ Fix: accetta bookingId sia come service_slot_bookings.id (rep row)
      // sia come slot_id (id “aggregato”).
      const baseSelect = `
        id,
        user_id,
        slot_id,
        dog_id,
        dog_ids,
        service_type,
        service_variant,
        status,
        notes,
        taxi_enabled,
        taxi_distance_km,
        taxi_price_eur,
        credits_spent,
        total_price,
        created_at,
        service_slots:slot_id ( id, start_at, end_at, service_type, service_variant )
      `;

      let repRow: ServiceSlotBookingQueryRow | null = null;

      {
        const { data, error: repErr } = await supabase
          .from('service_slot_bookings')
          .select(baseSelect)
          .eq('id', bookingId)
          .maybeSingle();

        if (requestSeqRef.current !== mySeq) return;
        if (repErr) throw new Error(`Errore Supabase (service_slot_bookings): ${repErr.message}`);

        repRow = (data ?? null) as ServiceSlotBookingQueryRow | null;
      }

      if (!repRow) {
        const { data, error: repSlotErr } = await supabase
          .from('service_slot_bookings')
          .select(baseSelect)
          .eq('slot_id', bookingId)
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (requestSeqRef.current !== mySeq) return;
        if (repSlotErr) throw new Error(`Errore Supabase (service_slot_bookings by slot_id): ${repSlotErr.message}`);

        repRow = (data ?? null) as ServiceSlotBookingQueryRow | null;
      }

      if (!repRow) throw new Error('Prenotazione non trovata.');
      if (repRow.user_id !== userId) throw new Error('Prenotazione non trovata.');
      if (!repRow.slot_id) throw new Error('Prenotazione non valida (slot mancante).');

      const { data: allRows, error: allErr } = await supabase
        .from('service_slot_bookings')
        .select(baseSelect)
        .eq('slot_id', repRow.slot_id)
        .eq('user_id', userId);

      if (requestSeqRef.current !== mySeq) return;
      if (allErr) throw new Error(`Errore Supabase (service_slot_bookings group): ${allErr.message}`);

      const rows = (allRows ?? []) as ServiceSlotBookingQueryRow[];
      const groupedRows = rows.length > 0 ? rows : [repRow];
      const slot = firstRelation(groupedRows[0]?.service_slots) ?? firstRelation(repRow.service_slots);
      const serviceType = repRow.service_type ?? slot?.service_type;
      if (!serviceType) throw new Error('Prenotazione non valida (servizio mancante).');

      const dogMap = await loadServiceSlotDogSummaryMap(groupedRows);
      const dogs = Array.from(
        new Map(
          groupedRows
            .flatMap((row) => mapServiceSlotDogs(row, dogMap))
            .map((dog) => [dog.id, dog] as const)
        ).values()
      );

      const taxiRow = groupedRows.find((r) => !!r.taxi_enabled) ?? repRow;

      const slotBooking: ServiceSlotBookingDetail = {
        rep_id: repRow.id,
        slot_id: repRow.slot_id,
        user_id: repRow.user_id,
        service_type: serviceType,
        service_variant: repRow.service_variant ?? slot?.service_variant ?? null,
        status: pickGroupStatus(groupedRows.map((r) => r.status)),
        notes: groupedRows.map((r) => r.notes).find((n) => !!n) ?? repRow.notes ?? null,
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
      };

      setDetail({ kind: 'SERVICE_SLOT', slotBooking });
      setStatus('success');
    } catch (e) {
      if (requestSeqRef.current !== mySeq) return;
      console.error('useBookingDetail error:', e);
      setDetail(null);
      setStatus('error');
      setError(getErrorMessage(e, 'Errore nel caricamento della prenotazione.'));
    }
  }, [userId, bookingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, detail, refresh };
}
