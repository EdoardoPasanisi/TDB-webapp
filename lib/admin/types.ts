import type { BookingDogExtras, TaxiDistanceBand, TaxiOption } from '@/types/booking';
import type { Dog } from '@/types/dog';
import type { Profile } from '@/types/profile';
import type { BookingStatus } from '@/types/booking';
import type { ServicePassRow, ServiceStatus, ServiceType, ServiceVariant } from '@/types/services';

export type StaffRole = 'ADMIN' | 'VIEWER';

export type AdminStaffAccess = {
  userId: string;
  email: string | null;
  role: StaffRole;
  canManage: boolean;
};

export type AdminDocumentKind = 'ID_DOCUMENT' | 'WAIVER_SIGNED';
export type AdminDocumentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type AdminServiceKey =
  | 'PENSIONE'
  | 'ASILO'
  | 'ADDESTRAMENTO'
  | 'CONSULENZA'
  | 'TOELETTATURA'
  | 'VACCINAZIONE'
  | 'TRACKING'
  | 'FITNESS'
  | 'PASSEGGIATA'
  | 'TREKKING'
  | 'TERAPIA'
  | 'TAXI_DOG';

export type AdminBookingKind = 'PENSIONE' | 'SERVICE_SLOT';
export type AdminAnyBookingStatus = BookingStatus | ServiceStatus | null;

export type AdminUserListItem = {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  dogsCount: number;
  activeBookings: number;
  pendingDocuments: number;
  dogNames: string[];
  staffRole: StaffRole | null;
};

export type AdminDogListItem = {
  dogId: string;
  name: string;
  breed: string | null;
  microchip: string | null;
  sizeCategory: Dog['size_category'] | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  activeBookings: number;
  staffRole: StaffRole | null;
};

export type AdminDocumentRecord = {
  id: string;
  userId: string;
  ownerName: string | null;
  kind: AdminDocumentKind;
  path: string;
  fileName: string;
  status: AdminDocumentStatus;
  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  staffNote: string | null;
  signedUrl: string | null;
};

export type AdminAgendaItem = {
  itemKey: string;
  kind: AdminBookingKind;
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  dogNames: string[];
  serviceKey: AdminServiceKey;
  serviceType: ServiceType | null;
  serviceVariant: ServiceVariant | null;
  serviceLabel: string;
  status: AdminAnyBookingStatus;
  startAt: string;
  endAt: string | null;
  totalPrice: number | null;
  notes: string | null;
  isActive: boolean;
  meta: string[];
  summaryLines: string[];
};

export type AdminSlotRecord = {
  id: string;
  serviceType: ServiceType;
  serviceVariant: ServiceVariant | null;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  remainingCount: number;
  notes: string | null;
};

export type AdminOverviewServiceCount = {
  serviceKey: AdminServiceKey;
  label: string;
  count: number;
};

export type AdminOverview = {
  totals: {
    users: number;
    dogs: number;
    activeBookings: number;
    pendingBookings: number;
    pendingDocuments: number;
    presentDogs: number;
    activePensione: number;
    checkInsToday: number;
    checkOutsToday: number;
    servicesToday: number;
  };
  serviceCountsToday: AdminOverviewServiceCount[];
  todayServices: AdminAgendaItem[];
  pendingBookings: AdminAgendaItem[];
  pendingDocuments: AdminDocumentRecord[];
  urgentItems: AdminAgendaItem[];
};

export type AdminAnalytics = {
  totals: {
    users: number;
    activeUsers: number;
    dogs: number;
    activeDogs: number;
    confirmedRevenue: number;
    confirmedBookings: number;
    last30DaysRevenue: number;
    last30DaysBookings: number;
  };
  revenueByService: Array<{
    serviceKey: Extract<AdminServiceKey, 'PENSIONE' | 'ASILO' | 'ADDESTRAMENTO' | 'CONSULENZA'>;
    label: string;
    revenue: number;
    bookings: number;
  }>;
};

export type AdminUserDetail = {
  userId: string;
  profile: Profile | null;
  staffRole: StaffRole | null;
  dogs: Dog[];
  servicePasses: ServicePassRow[];
  documents: AdminDocumentRecord[];
  activeTimeline: AdminAgendaItem[];
  historyTimeline: AdminAgendaItem[];
};

export type AdminDogDetail = {
  dog: Dog;
  owner: Profile | null;
  ownerStaffRole: StaffRole | null;
  activeTimeline: AdminAgendaItem[];
  historyTimeline: AdminAgendaItem[];
};

export type AdminStaffMember = {
  userId: string;
  fullName: string;
  email: string | null;
  role: StaffRole;
  createdAt: string;
  updatedAt: string;
};

export type AdminDateViewResponse = {
  items: AdminAgendaItem[];
  slots: AdminSlotRecord[];
};

export type AdminServicesViewResponse = {
  items: AdminAgendaItem[];
  slots: AdminSlotRecord[];
};

export type AdminBookingDetail = {
  kind: AdminBookingKind;
  id: string;
  status: AdminAnyBookingStatus;
  serviceKey: AdminServiceKey;
  serviceType: ServiceType | null;
  serviceVariant: ServiceVariant | null;
  serviceLabel: string;
  startAt: string;
  endAt: string | null;
  totalPrice: number | null;
  notes: string | null;
  meta: string[];
  booking: {
    createdAt: string | null;
    arrivalTime: string | null;
    departureTime: string | null;
    taxiPickupTime: string | null;
    taxiReturnTime: string | null;
    taxiDistanceBand: TaxiDistanceBand | null;
  };
  user: {
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    dogAddressLine: string | null;
    dogCity: string | null;
    dogZipCode: string | null;
    dogProvince: string | null;
    profile: Profile | null;
  };
  dogs: Array<{
    dogId: string;
    name: string;
    breed: string | null;
    microchip: string | null;
    sizeCategory: Dog['size_category'] | null;
    groomingDifficulty: Dog['grooming_difficulty'] | null;
    sex: Dog['sex'] | null;
    birthDate: string | null;
    notes: string | null;
    coatColor: string | null;
    temperament: string[] | null;
    extras: BookingDogExtras | null;
    pricing: {
      accommodationType: string | null;
      accommodationPricePerDay: number | null;
      daysCount: number | null;
      accommodationSubtotal: number | null;
      extrasSubtotal: number | null;
      total: number | null;
    };
  }>;
  taxi: {
    enabled: boolean;
    option: TaxiOption | null;
    distanceKm: number | null;
    priceEur: number | null;
  };
  credits: {
    passId: string | null;
    creditsSpent: number | null;
  };
};
