// FILE: lib/services/hooks/useFutureBookings.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { BookingStatus, UnifiedBookingListItem } from '@/types/booking';
import { getPensioneBookingsForUserInRange } from '@/lib/services/bookingsApi';
import { getUserServiceSlotBookingsInRange } from '@/lib/services/serviceCalendarApi';

type BookingLoadState = {
  loading: boolean;
  error: string | null;
  bookings: UnifiedBookingListItem[];
};

function toSortKey(b: UnifiedBookingListItem) {
  if (b.kind === 'PENSIONE') return new Date(b.start_date).getTime();
  return new Date(b.start_at).getTime();
}

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

type SlotBookingListItem = Extract<UnifiedBookingListItem, { kind: 'SERVICE_SLOT' }>;

type SlotAggregate = {
  slotId: string;
  service_type: SlotBookingListItem['service_type'];
  service_variant: SlotBookingListItem['service_variant'];
  status: SlotBookingListItem['status'];
  start_at: string;
  end_at: string;
  dogNames: string[];
  total_price_sum: number;
  has_total_price: boolean;
  taxi_enabled: boolean;
};

const STATUS_PRIORITY: Record<BookingStatus, number> = {
  PAID: 60,
  CONFIRMED: 50,
  PENDING: 40,
  DRAFT: 30,
  COMPLETED: 20,
  CANCELLED: 10,
};

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function toUtcStartOfDayIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00.000Z`).toISOString();
}

function pickHigherStatus(a: BookingStatus | null, b: BookingStatus | null): BookingStatus | null {
  if (!a) return b;
  if (!b) return a;
  return STATUS_PRIORITY[b] > STATUS_PRIORITY[a] ? b : a;
}

export function useFutureBookings(
  userId: string | undefined,
  options?: { mode?: 'future' | 'history' },
) {
  const mode = options?.mode ?? 'future';
  const [loading, setLoading] = useState<BookingLoadState['loading']>(false);
  const [error, setError] = useState<BookingLoadState['error']>(null);
  const [bookings, setBookings] = useState<BookingLoadState['bookings']>([]);
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBookings([]);
      setError(null);
      setLoading(false);
      return;
    }

    const reqSeq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      // future: da oggi ai prossimi 6 mesi. history: tutte (5 anni indietro → +1 anno).
      const startDate =
        mode === 'history' ? toDateKey(addMonths(now, -60)) : toDateKey(now);
      const rangeEnd = mode === 'history' ? addMonths(now, 12) : addMonths(now, 6);
      const endDateExclusive = toDateKey(addDays(rangeEnd, 1));

      const startIso = toUtcStartOfDayIso(startDate);
      const endIso = toUtcStartOfDayIso(endDateExclusive);

      const [pensioneRows, slotRows] = await Promise.all([
        getPensioneBookingsForUserInRange({ userId, startDate, endDateExclusive }),
        getUserServiceSlotBookingsInRange({ userId, startIso, endIso }),
      ]);
      if (requestSeqRef.current !== reqSeq) return;

      const pensioneUnified: UnifiedBookingListItem[] = pensioneRows.map((booking) => ({
        kind: 'PENSIONE',
        id: booking.id,
        service_type: booking.service_type,
        status: booking.status ?? null,
        start_date: booking.start_date,
        end_date: booking.end_date ?? null,
        arrival_time: booking.arrival_time ?? null,
        departure_time: booking.departure_time ?? null,
        dogs_count: booking.dogs_count ?? null,
        total_price: booking.total_price ?? null,
        taxi_option: booking.taxi_option ?? null,
        dogNames: booking.dogNames,
        extrasSummary: booking.extrasSummary,
      }));

      const bySlot = new Map<string, SlotAggregate>();

      for (const booking of slotRows) {
        const slot = booking.service_slots;
        const slotId = booking.slot_id ?? slot?.id ?? null;
        if (!slotId) continue;

        const existing = bySlot.get(slotId);
        const dogNames = booking.dogs
          .map((dog) => dog.name?.trim() ?? '')
          .filter(Boolean);

        const status = booking.status ?? null;
        const isPaid = status === 'PAID';

        if (!existing) {
          bySlot.set(slotId, {
            slotId,
            service_type: booking.service_type,
            service_variant: booking.service_variant ?? slot?.service_variant ?? null,
            status,
            start_at: slot?.start_at ?? '',
            end_at: slot?.end_at ?? '',
            dogNames,
            total_price_sum: typeof booking.total_price === 'number' ? booking.total_price : 0,
            has_total_price: typeof booking.total_price === 'number',
            taxi_enabled: booking.taxi_enabled,
          });
        } else {
          existing.status = pickHigherStatus(existing.status, status);
          if (existing.service_variant == null && (booking.service_variant ?? slot?.service_variant) != null) {
            existing.service_variant = booking.service_variant ?? slot?.service_variant ?? null;
          }
          for (const dogName of dogNames) {
            if (!existing.dogNames.includes(dogName)) existing.dogNames.push(dogName);
          }
          if (typeof booking.total_price === 'number') {
            existing.total_price_sum += booking.total_price;
            existing.has_total_price = true;
          }
          existing.taxi_enabled = existing.taxi_enabled || booking.taxi_enabled;
          if (isPaid) existing.status = 'PAID';
        }
      }

      const slotUnified: UnifiedBookingListItem[] = Array.from(bySlot.values()).map((g) => ({
        kind: 'SERVICE_SLOT',
        id: g.slotId,
        service_type: g.service_type,
        service_variant: g.service_variant ?? null,
        status: g.status,
        start_at: g.start_at,
        end_at: g.end_at,
        dogNames: g.dogNames,
        total_price: g.has_total_price ? g.total_price_sum : null,
        taxi_enabled: g.taxi_enabled,
      }));

      const merged = [...pensioneUnified, ...slotUnified].sort((a, b) => toSortKey(a) - toSortKey(b));
      if (requestSeqRef.current !== reqSeq) return;
      setBookings(merged);
    } catch (error) {
      if (requestSeqRef.current !== reqSeq) return;
      console.error('useFutureBookings error:', error);
      setError(getErrorMessage(error, 'Errore nel caricamento delle prenotazioni.'));
      setBookings([]);
    } finally {
      if (requestSeqRef.current !== reqSeq) return;
      setLoading(false);
    }
  }, [userId, mode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, bookings, refresh };
}
