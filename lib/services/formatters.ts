// lib/services/formatters.ts
import type { AccommodationKey, BookingStatus, ServiceType, TaxiOption } from '@/types/booking';

export function serviceLabel(service: ServiceType): string {
  switch (service) {
    case 'PENSIONE':
      return 'Pensione';
    case 'ASILO':
      return 'Asilo';
    case 'ADDESTRAMENTO':
      return 'Addestramento';
    case 'CONSULENZA':
      return 'Consulenza';
    case 'TARGHETTA':
      return 'Targhetta';
    default:
      return service;
  }
}

export function statusLabel(status: BookingStatus | null | undefined): string {
  switch (status) {
    case 'DRAFT':
      return 'Bozza';
    case 'PENDING':
      return 'In attesa';
    case 'CONFIRMED':
      return 'Confermata';
    case 'PAID':
      return 'Pagata';
    case 'CANCELLED':
      return 'Annullata';
    case 'COMPLETED':
      return 'Completata';
    default:
      return '—';
  }
}

/**
 * Input: YYYY-MM-DD
 * Output: DD/MM/YYYY
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function euro(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return `${value.toFixed(2)}€`;
}

export function taxiLabel(option: TaxiOption | null | undefined): string {
  switch (option) {
    case 'NONE':
      return 'No taxi dog';
    case 'ONE_WAY':
      return 'Taxi dog (solo andata)';
    case 'RETURN_ONLY':
      return 'Taxi dog (solo ritorno)';
    case 'ROUND_TRIP':
      return 'Taxi dog (andata e ritorno)';
    default:
      return '';
  }
}

const ACCOMMODATION_LABELS: Record<AccommodationKey, string> = {
  BOX: 'Box',
  BOX_GARDEN: 'Box con giardino',
  CHALET: 'Chalet',
  APT_GARDEN: 'Appartamento con giardino',
  APT_GARDEN_NIGHT_PERSON: 'Appartamento con giardino (presenza notturna)',
  CATTERY: 'Gattile',
};

export function accommodationLabel(key: AccommodationKey | null | undefined): string {
  if (!key) return '—';
  return ACCOMMODATION_LABELS[key] ?? key;
}
