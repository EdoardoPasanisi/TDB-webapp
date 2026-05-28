'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { ServiceSlotDogSummary } from '@/lib/services/serviceSlotDogs';
import type { BookingDogRow, BookingRow, BookingStatus } from '@/types/booking';
import type { ServiceType as SlotServiceType, ServiceVariant } from '@/types/services';

type Status = 'idle' | 'loading' | 'success' | 'error';

type DogMini = ServiceSlotDogSummary;
export type BookingDogDetailRow = BookingDogRow & { dogName: string; dogBreed: string | null };

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
      const response = await fetch(`/api/bookings/${bookingId}`);

      if (requestSeqRef.current !== mySeq) return;

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof body.error === 'string' ? body.error : `Errore ${response.status}`);
      }

      const data = await response.json() as BookingDetailData;

      if (requestSeqRef.current !== mySeq) return;

      setDetail(data);
      setStatus('success');
    } catch (e) {
      if (requestSeqRef.current !== mySeq) return;
      console.error('useBookingDetail error:', e);
      setDetail(null);
      setStatus('error');
      setError(humanizeErrorMessage(e, 'Errore nel caricamento della prenotazione.'));
    }
  }, [userId, bookingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, detail, refresh };
}
