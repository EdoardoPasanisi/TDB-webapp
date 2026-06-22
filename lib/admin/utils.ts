import type { BookingDogExtras, BookingStatus, TaxiOption } from '@/types/booking';
import type { ServiceStatus, ServiceType, ServiceVariant } from '@/types/services';
import type { AdminAnyBookingStatus, AdminServiceKey, StaffRole } from '@/lib/admin/types';
import { getServiceLabel } from '@/types/services';

export const ADMIN_ACTIVE_STATUSES: Array<BookingStatus | ServiceStatus> = ['PENDING', 'CONFIRMED', 'PAID'];
export const ADMIN_PENDING_STATUS: BookingStatus | ServiceStatus = 'PENDING';

export const ADMIN_SERVICE_OPTIONS: Array<{ key: AdminServiceKey; label: string }> = [
  { key: 'PENSIONE', label: 'Pensione' },
  { key: 'ASILO', label: 'Asilo' },
  { key: 'ADDESTRAMENTO', label: 'Addestramento' },
  { key: 'CONSULENZA', label: 'Consulenza' },
  { key: 'TOELETTATURA', label: 'Toelettatura' },
  { key: 'VACCINAZIONE', label: 'Vaccinazione' },
  { key: 'TRACKING', label: 'Ricerca olfattiva' },
  { key: 'FITNESS', label: 'Fitness' },
  { key: 'PASSEGGIATA', label: 'Passeggiata' },
  { key: 'TREKKING', label: 'Trekking' },
  { key: 'TERAPIA', label: 'Terapia' },
  { key: 'TAXI_DOG', label: 'Taxi dog' },
];

export const STAFF_ROLE_OPTIONS: Array<{ value: StaffRole; label: string }> = [
  { value: 'SUPER_ADMIN', label: 'Admin' },
  { value: 'ADMIN', label: 'Poteri completi' },
  { value: 'VIEWER', label: 'Sola lettura' },
];

export function sanitizeSearchTerm(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replaceAll('%', '')
    .replaceAll(',', ' ')
    .replace(/\s+/g, ' ');
}

export function buildIlikePattern(value: string | null | undefined): string {
  const term = sanitizeSearchTerm(value);
  return `%${term}%`;
}

export function formatPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallbackEmail?: string | null
): string {
  const fullName = [firstName, lastName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fullName) return fullName;
  return String(fallbackEmail ?? '').trim() || 'Utente senza nome';
}

export function isActiveBookingStatus(status: AdminAnyBookingStatus): boolean {
  if (!status) return false;
  return ADMIN_ACTIVE_STATUSES.includes(status);
}

export function getAdminStatusLabel(status: AdminAnyBookingStatus): string {
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

export function getAdminRoleLabel(role: StaffRole | null | undefined): string {
  if (role === 'SUPER_ADMIN') return 'Admin';
  if (role === 'ADMIN') return 'Poteri completi';
  if (role === 'VIEWER') return 'Sola lettura';
  return 'Nessun accesso gestionale';
}

export function getAdminServiceLabel(
  serviceKey: AdminServiceKey,
  serviceType?: ServiceType | null,
  serviceVariant?: ServiceVariant | null
): string {
  if (serviceKey === 'PENSIONE') return 'Pensione';
  if (serviceKey === 'ASILO') return getServiceLabel('ASILO', serviceVariant ?? null);
  if (serviceKey === 'ADDESTRAMENTO') return getServiceLabel('ADDESTRAMENTO', serviceVariant ?? null);
  if (serviceKey === 'CONSULENZA') return getServiceLabel('CONSULENZA', serviceVariant ?? null);
  if (serviceKey === 'TOELETTATURA') return 'Toelettatura';
  if (serviceKey === 'VACCINAZIONE') return 'Vaccinazione';
  if (serviceKey === 'TRACKING') return 'Ricerca olfattiva';
  if (serviceKey === 'FITNESS') return 'Fitness';
  if (serviceKey === 'PASSEGGIATA') return 'Passeggiata';
  if (serviceKey === 'TREKKING') return 'Trekking';
  if (serviceKey === 'TERAPIA') return 'Terapia';
  if (serviceKey === 'TAXI_DOG') return 'Taxi dog';

  if (serviceType) return getServiceLabel(serviceType, serviceVariant ?? null);
  return serviceKey;
}

export function getDateRangeBounds(startDate: string, endDate: string): { startIso: string; endIso: string } {
  return {
    startIso: `${startDate}T00:00:00.000Z`,
    endIso: `${endDate}T23:59:59.999Z`,
  };
}

export function bookingMatchesServiceKey(args: {
  serviceType: ServiceType | null;
  extras?: BookingDogExtras | null;
  taxiOption?: TaxiOption | null;
  taxiEnabled?: boolean | null;
  filterKey: AdminServiceKey;
}): boolean {
  const { serviceType, extras, taxiOption, taxiEnabled, filterKey } = args;

  if (filterKey === 'PENSIONE' || filterKey === 'ASILO' || filterKey === 'ADDESTRAMENTO' || filterKey === 'CONSULENZA') {
    return serviceType === filterKey;
  }

  if (filterKey === 'TOELETTATURA') return Boolean(extras?.grooming);
  if (filterKey === 'VACCINAZIONE') return Boolean(extras?.vaccine);
  if (filterKey === 'TRACKING') return Boolean((extras?.trackingSessions ?? 0) > 0);
  if (filterKey === 'FITNESS') return Boolean((extras?.fitnessSessions ?? 0) > 0);
  if (filterKey === 'PASSEGGIATA') return Boolean((extras?.walkSessions ?? 0) > 0);
  if (filterKey === 'TREKKING') return Boolean((extras?.trekkingSessions ?? 0) > 0);
  if (filterKey === 'TERAPIA') return Boolean(extras?.therapyActive);
  if (filterKey === 'TAXI_DOG') return taxiOption ? taxiOption !== 'NONE' : Boolean(taxiEnabled);

  return false;
}

export function fileNameFromPath(path: string): string {
  const trimmed = String(path ?? '').trim();
  if (!trimmed) return 'file';
  const parts = trimmed.split('/');
  return parts[parts.length - 1] ?? 'file';
}
