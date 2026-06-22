export type CustomerMediaType = 'IMAGE' | 'VIDEO';

export type CustomerMediaProvider = 'supabase' | 'cloudflare_stream';

export type CustomerMediaStatus = 'processing' | 'ready' | 'error';

export type CustomerMediaRow = {
  id: string;
  user_id: string;
  booking_id: string;
  dog_id: string | null;
  media_type: CustomerMediaType;
  storage_path: string | null;
  caption: string | null;
  visible_until: string;
  created_by_staff_user_id: string | null;
  created_at: string;
  provider: CustomerMediaProvider;
  stream_uid: string | null;
  status: CustomerMediaStatus;
  duration_seconds: number | null;
  thumbnail_url: string | null;
};

export type CustomerMediaViewItem = {
  id: string;
  mediaType: CustomerMediaType;
  caption: string | null;
  createdAt: string;
  visibleUntil: string;
  status: CustomerMediaStatus;
  // Foto: signed URL Supabase. Video pronti: URL iframe Cloudflare firmato. Video in elaborazione: null.
  mediaUrl: string | null;
  mimeType: string | null;
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
  daysWithoutMedia: number;
  mediaCount: number;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
};
