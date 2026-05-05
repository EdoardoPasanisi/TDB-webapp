import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { createUserNotificationIfEnabled } from '@/lib/notifications/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ADMIN_ACTIVE_STATUSES, formatPersonName } from '@/lib/admin/utils';
import type { CustomerMediaRow, CustomerMediaType, CustomerMediaViewItem, AdminMediaRecapItem } from '@/types/media';
import {
  MAX_CUSTOMER_MEDIA_BYTES,
  CUSTOMER_MEDIA_MIME_TYPES,
  validateUploadFile,
} from '@/lib/validation/uploads';

const CUSTOMER_MEDIA_BUCKET = 'customer-media';

type BookingMediaUploadRow = {
  id: string;
  user_id: string;
  service_type: string | null;
  status: string | null;
  start_date: string;
  end_date: string | null;
  departure_time: string | null;
  booking_dogs?: Array<{
    dog_id: string;
    dogs?:
      | {
          id: string;
          name: string;
        }
      | Array<{
          id: string;
          name: string;
        }>
      | null;
  }> | null;
};

type ProfileSummary = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function castMediaRow(row: unknown): CustomerMediaRow {
  return row as CustomerMediaRow;
}

function guessMediaExtension(file: File): string {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  if (byType[file.type]) return byType[file.type];

  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? 'bin';
}

function getMediaTypeFromFile(file: File): CustomerMediaType {
  return String(file.type).startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

function computeVisibleUntil(endDate: string | null, departureTime: string | null): string {
  const dateKey = endDate || new Date().toISOString().slice(0, 10);
  const timeValue = String(departureTime ?? '').trim() || '18:00:00';
  const base = new Date(`${dateKey}T${timeValue}`);
  const timestamp = Number.isFinite(base.getTime()) ? base.getTime() : Date.now();
  return new Date(timestamp + 24 * 60 * 60 * 1000).toISOString();
}

function buildMediaPath(args: {
  userId: string;
  bookingId: string;
  ext: string;
}): string {
  const stamp = Date.now();
  return `${args.userId}/${args.bookingId}/${stamp}.${args.ext}`;
}

function computePriority(lastMediaAt: string | null, startDate: string): {
  priority: AdminMediaRecapItem['priority'];
  priorityScore: number;
} {
  if (!lastMediaAt) {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const days = Number.isFinite(start) ? Math.max(0, (Date.now() - start) / (24 * 60 * 60 * 1000)) : 0;
    return { priority: 'URGENT', priorityScore: 10_000 + days };
  }

  const diffHours = Math.max(0, (Date.now() - new Date(lastMediaAt).getTime()) / (60 * 60 * 1000));
  if (diffHours >= 48) return { priority: 'HIGH', priorityScore: diffHours };
  if (diffHours >= 24) return { priority: 'MEDIUM', priorityScore: diffHours };
  return { priority: 'LOW', priorityScore: diffHours };
}

async function createSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(CUSTOMER_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 30);

  if (error) return null;
  return data.signedUrl;
}

export async function listVisibleMediaForUser(userId: string): Promise<CustomerMediaViewItem[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('customer_media')
    .select('*')
    .eq('user_id', userId)
    .gte('visible_until', nowIso)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map(castMediaRow);
  const urls = await Promise.all(rows.map((row) => createSignedUrl(row.storage_path)));

  return rows
    .map((row, index) => {
      const signedUrl = urls[index];
      if (!signedUrl) return null;
      return {
        id: row.id,
        mediaType: row.media_type,
        caption: row.caption,
        createdAt: row.created_at,
        visibleUntil: row.visible_until,
        signedUrl,
      } satisfies CustomerMediaViewItem;
    })
    .filter((item): item is CustomerMediaViewItem => Boolean(item));
}

export async function listAdminMediaRecap(): Promise<AdminMediaRecapItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: bookingsData, error: bookingsError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, service_type, status, start_date, end_date, departure_time, booking_dogs(dog_id, dogs(id, name))')
    .eq('service_type', 'PENSIONE')
    .in('status', ADMIN_ACTIVE_STATUSES)
    .lte('start_date', today)
    .gte('end_date', today);

  if (bookingsError) throw new Error(bookingsError.message);

  const bookings = (bookingsData ?? []) as unknown as BookingMediaUploadRow[];
  if (bookings.length === 0) return [];

  const userIds = Array.from(new Set(bookings.map((booking) => booking.user_id)));
  const bookingIds = bookings.map((booking) => booking.id);

  const [{ data: profilesData, error: profilesError }, { data: mediaData, error: mediaError }] =
    await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds),
      supabaseAdmin
        .from('customer_media')
        .select('id, booking_id, media_type, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false }),
    ]);

  if (profilesError) throw new Error(profilesError.message);
  if (mediaError) throw new Error(mediaError.message);

  const profileMap = new Map(
    ((profilesData ?? []) as ProfileSummary[]).map((profile) => [profile.user_id, profile])
  );
  const mediaByBookingId = new Map<string, Array<Pick<CustomerMediaRow, 'id' | 'created_at' | 'media_type'>>>();

  for (const row of (mediaData ?? []) as Array<Pick<CustomerMediaRow, 'id' | 'booking_id' | 'created_at' | 'media_type'>>) {
    const current = mediaByBookingId.get(row.booking_id) ?? [];
    current.push({ id: row.id, created_at: row.created_at, media_type: row.media_type });
    mediaByBookingId.set(row.booking_id, current);
  }

  return bookings
    .map((booking) => {
      const profile = profileMap.get(booking.user_id) ?? null;
      const mediaItems = mediaByBookingId.get(booking.id) ?? [];
      const latest = mediaItems[0] ?? null;
      const { priority, priorityScore } = computePriority(latest?.created_at ?? null, booking.start_date);

      return {
        bookingId: booking.id,
        userId: booking.user_id,
        ownerName: formatPersonName(profile?.first_name ?? null, profile?.last_name ?? null, profile?.email ?? null),
        ownerEmail: profile?.email ?? null,
        dogNames: (booking.booking_dogs ?? [])
          .map((item) => {
            const dog = Array.isArray(item.dogs) ? item.dogs[0] ?? null : item.dogs ?? null;
            return dog?.name ?? '';
          })
          .filter(Boolean),
        startDate: booking.start_date,
        endDate: booking.end_date ?? null,
        status: booking.status ?? null,
        lastMediaAt: latest?.created_at ?? null,
        lastMediaType: latest?.media_type ?? null,
        mediaCount: mediaItems.length,
        priority,
        priorityScore,
      } satisfies AdminMediaRecapItem;
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return order[a.priority] - order[b.priority];
      }
      return b.priorityScore - a.priorityScore;
    });
}

export async function uploadMediaForBooking(args: {
  bookingId: string;
  caption?: string | null;
  staffUserId: string;
  file: File;
}): Promise<CustomerMediaRow> {
  const validationError = validateUploadFile({
    file: args.file,
    allowedMimeTypes: CUSTOMER_MEDIA_MIME_TYPES,
    maxBytes: MAX_CUSTOMER_MEDIA_BYTES,
    invalidTypeMessage: 'Formato non valido. Usa JPG, PNG, WebP, MP4, MOV o WebM.',
    tooLargeMessage: 'Il media è troppo grande. Limite massimo: 50MB.',
  });

  if (validationError) {
    throw new Error(validationError);
  }

  const { data: bookingData, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, service_type, status, start_date, end_date, departure_time')
    .eq('id', args.bookingId)
    .maybeSingle();

  const booking = (bookingData ?? null) as Omit<BookingMediaUploadRow, 'booking_dogs'> | null;
  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Prenotazione pensione non trovata.');
  }

  if (booking.service_type !== 'PENSIONE') {
    throw new Error('Puoi inviare media solo per prenotazioni pensione.');
  }

  if (!booking.status || !ADMIN_ACTIVE_STATUSES.includes(booking.status as (typeof ADMIN_ACTIVE_STATUSES)[number])) {
    throw new Error('Puoi inviare media solo per pensioni attive.');
  }

  const ext = guessMediaExtension(args.file);
  const storagePath = buildMediaPath({
    userId: booking.user_id,
    bookingId: booking.id,
    ext,
  });

  const mediaType = getMediaTypeFromFile(args.file);
  const bytes = new Uint8Array(await args.file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(CUSTOMER_MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      upsert: false,
      contentType: args.file.type || 'application/octet-stream',
      cacheControl: '31536000',
    });

  if (uploadError) {
    throw new Error(humanizeErrorMessage(uploadError, 'Non siamo riusciti a caricare il media.'));
  }

  const { data, error } = await supabaseAdmin
    .from('customer_media')
    .insert({
      user_id: booking.user_id,
      booking_id: booking.id,
      media_type: mediaType,
      storage_path: storagePath,
      caption: String(args.caption ?? '').trim() || null,
      visible_until: computeVisibleUntil(booking.end_date ?? booking.start_date, booking.departure_time),
      created_by_staff_user_id: args.staffUserId,
    })
    .select('*')
    .single();

  if (error || !data) {
    await supabaseAdmin.storage.from(CUSTOMER_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(error?.message ?? 'Non siamo riusciti a registrare il media.');
  }

  await createUserNotificationIfEnabled({
    userId: booking.user_id,
    type: 'MEDIA_AVAILABLE',
    title: mediaType === 'VIDEO' ? 'Nuovo video disponibile' : 'Nuova foto disponibile',
    body: 'Abbiamo caricato un nuovo contenuto del tuo cane nella sezione I tuoi media.',
    data: {
      href: '/profile',
      bookingId: booking.id,
    },
  });

  return castMediaRow(data);
}
