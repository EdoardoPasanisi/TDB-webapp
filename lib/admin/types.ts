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
  isActive: boolean;
  notes: string | null;
};

export type AdminOverview = {
  totals: {
    users: number;
    dogs: number;
    activeBookings: number;
    pendingBookings: number;
    pendingDocuments: number;
  };
  pendingBookings: AdminAgendaItem[];
  pendingDocuments: AdminDocumentRecord[];
  upcomingServices: AdminAgendaItem[];
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
  email: string | null;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminDateViewResponse = {
  items: AdminAgendaItem[];
  slots: AdminSlotRecord[];
};
