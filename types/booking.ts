// FILE: types/booking.ts

import type { ServiceVariant } from '@/types/services';

export type ServiceType =
  | 'PENSIONE'
  | 'ASILO'
  | 'ADDESTRAMENTO'
  | 'CONSULENZA'
  | 'TARGHETTA';

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PAID'
  | 'CANCELLED'
  | 'COMPLETED';

export type TaxiOption = 'NONE' | 'ONE_WAY' | 'RETURN_ONLY' | 'ROUND_TRIP';
export type TaxiDistanceBand = 'ENTRO_40' | 'OLTRE_40';

export type AccommodationKey =
  | 'BOX'
  | 'BOX_GARDEN'
  | 'CHALET'
  | 'APT_GARDEN'
  | 'APT_GARDEN_NIGHT_PERSON'
  | 'CATTERY';

export interface BookingDogExtras {
  grooming?: boolean;
  vaccine?: boolean;
  trackingSessions?: number; // Ricerca olfattiva
  fitnessSessions?: number;
  walkSessions?: number;
  trekkingSessions?: number; // Trekking in campagna
  therapyActive?: boolean;
  therapyNotes?: string;
}

export interface BookingRow {
  id: string;
  user_id: string;
  dog_id: string | null;

  service_type: ServiceType;

  start_date: string;
  end_date: string | null;

  arrival_time: string | null;
  departure_time: string | null;

  notes: string | null;

  status: BookingStatus | null;
  dogs_count: number | null;

  taxi_option: TaxiOption | null;
  taxi_distance_band: TaxiDistanceBand | null;
  taxi_price: number | null;

  taxi_pickup_time?: string | null;
  taxi_return_time?: string | null;

  alloggio_total_full: number | null;
  alloggio_discount_percent: number | null;
  alloggio_total_discounted: number | null;
  extras_total: number | null;
  total_price: number | null;

  created_at?: string;
  updated_at?: string;
}

export interface BookingDogRow {
  id: string;
  booking_id: string;
  dog_id: string;

  accommodation_type: AccommodationKey;
  accommodation_price_per_day: number;
  days_count: number;

  accommodation_subtotal: number;
  extras: BookingDogExtras;
  extras_subtotal: number;
  per_dog_total: number;

  created_at?: string;
  updated_at?: string;
}

export interface BookingListItem {
  id: string;
  service_type: ServiceType;
  status: BookingStatus | null;

  start_date: string;
  end_date: string | null;
  arrival_time: string | null;
  departure_time: string | null;

  dogs_count: number | null;
  total_price: number | null;

  taxi_option: TaxiOption | null;

  dogNames: string[];
  extrasSummary: string;
}

/**
 * Lista unificata (PENSIONE + SERVICE_SLOT).
 */
export type UnifiedBookingListItem =
  | ({ kind: 'PENSIONE' } & BookingListItem)
  | {
      kind: 'SERVICE_SLOT';
      id: string;
      service_type: ServiceType;
      service_variant?: ServiceVariant | null;
      status: BookingStatus | null;

      start_at: string; // timestamptz ISO
      end_at: string; // timestamptz ISO

      dogNames: string[];
      total_price: number | null;

      taxi_enabled: boolean;
    };
