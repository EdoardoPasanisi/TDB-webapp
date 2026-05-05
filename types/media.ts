export type CustomerMediaType = 'IMAGE' | 'VIDEO';

export type CustomerMediaRow = {
  id: string;
  user_id: string;
  booking_id: string;
  dog_id: string | null;
  media_type: CustomerMediaType;
  storage_path: string;
  caption: string | null;
  visible_until: string;
  created_by_staff_user_id: string | null;
  created_at: string;
};

export type CustomerMediaViewItem = {
  id: string;
  mediaType: CustomerMediaType;
  caption: string | null;
  createdAt: string;
  visibleUntil: string;
  signedUrl: string;
};

export type AdminMediaRecapItem = {
  bookingId: string;
  userId: string;
  ownerName: string;
  ownerEmail: string | null;
  dogNames: string[];
  startDate: string;
  endDate: string | null;
  status: string | null;
  lastMediaAt: string | null;
  lastMediaType: CustomerMediaType | null;
  mediaCount: number;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
};
