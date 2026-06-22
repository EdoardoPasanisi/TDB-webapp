import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { CUSTOMER_MEDIA_BUCKET } from '@/lib/media/config';
import { createUserNotificationIfEnabled } from '@/lib/notifications/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ADMIN_ACTIVE_STATUSES, formatPersonName } from '@/lib/admin/utils';
import type { CustomerMediaRow, CustomerMediaType, CustomerMediaViewItem, AdminMediaRecapItem } from '@/types/media';
import {
  MAX_CUSTOMER_MEDIA_BYTES,
  CUSTOMER_MEDIA_MIME_TYPES,
  validateUploadBytes,
  validateUploadFile,
  validateUploadMetadata,
} from '@/lib/validation/uploads';

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

function normalizeMimeType(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function guessMediaExtensionFromMetadata(args: {
  mimeType: string | null | undefined;
  fileName?: string | null;
}): string {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  const mimeType = normalizeMimeType(args.mimeType);
  if (byType[mimeType]) return byType[mimeType];

  const match = String(args.fileName ?? '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? 'bin';
}

function guessMediaExtension(file: File): string {
  return guessMediaExtensionFromMetadata({ mimeType: file.type, fileName: file.name });
}

function getMediaTypeFromMimeType(mimeType: string | null | undefined): CustomerMediaType {
  return normalizeMimeType(mimeType).startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

function getMediaTypeFromFile(file: File): CustomerMediaType {
  return getMediaTypeFromMimeType(file.type);
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
  const token = crypto.randomUUID();
  return `${args.userId}/${args.bookingId}/${stamp}-${token}.${args.ext}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getDaysWithoutMedia(lastMediaAt: string | null, startDate: string): number {
  const reference = lastMediaAt
    ? new Date(lastMediaAt).getTime()
    : new Date(`${startDate}T00:00:00`).getTime();

  if (!Number.isFinite(reference)) return 0;
  return Math.max(0, Math.floor((Date.now() - reference) / DAY_MS));
}

function computePriority(lastMediaAt: string | null, startDate: string): {
  priority: AdminMediaRecapItem['priority'];
  priorityScore: number;
} {
  if (!lastMediaAt) {
    const days = getDaysWithoutMedia(null, startDate);
    return { priority: 'URGENT', priorityScore: 10_000 + days };
  }

  const diffHours = Math.max(0, (Date.now() - new Date(lastMediaAt).getTime()) / (60 * 60 * 1000));
  if (diffHours >= 48) return { priority: 'HIGH', priorityScore: diffHours };
  if (diffHours >= 24) return { priority: 'MEDIUM', priorityScore: diffHours };
  return { priority: 'LOW', priorityScore: diffHours };
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
  if (rows.length === 0) return [];

  const { data: signedData } = await supabaseAdmin.storage
    .from(CUSTOMER_MEDIA_BUCKET)
    .createSignedUrls(rows.map((row) => row.storage_path), 60 * 30);

  const urlMap = new Map<string, string>(
    (signedData ?? [])
      .filter((item) => item.path !== null)
      .map((item) => [item.path!, item.signedUrl] as [string, string])
  );

  return rows
    .map((row) => {
      const signedUrl = urlMap.get(row.storage_path);
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
      const lastMediaAt = latest?.created_at ?? null;
      const { priority, priorityScore } = computePriority(lastMediaAt, booking.start_date);

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
        lastMediaAt,
        lastMediaType: latest?.media_type ?? null,
        daysWithoutMedia: getDaysWithoutMedia(lastMediaAt, booking.start_date),
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

function validateCustomerMediaMetadata(args: {
  mimeType: string | null | undefined;
  size: number;
}): string | null {
  return validateUploadMetadata({
    size: args.size,
    mimeType: args.mimeType,
    allowedMimeTypes: CUSTOMER_MEDIA_MIME_TYPES,
    maxBytes: MAX_CUSTOMER_MEDIA_BYTES,
    invalidTypeMessage: 'Formato non valido. Usa JPG, PNG, WebP, MP4, MOV o WebM.',
    tooLargeMessage: 'Il media è troppo grande. Limite massimo: 50MB.',
  });
}

async function getBookingForMediaUpload(bookingId: string): Promise<Omit<BookingMediaUploadRow, 'booking_dogs'>> {
  const { data: bookingData, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, service_type, status, start_date, end_date, departure_time')
    .eq('id', bookingId)
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

  return booking;
}

function assertStoragePathMatchesBooking(args: {
  storagePath: string;
  booking: Omit<BookingMediaUploadRow, 'booking_dogs'>;
}): void {
  const storagePath = String(args.storagePath ?? '').trim();
  const expectedPrefix = `${args.booking.user_id}/${args.booking.id}/`;

  if (!storagePath || storagePath.includes('..') || !storagePath.startsWith(expectedPrefix)) {
    throw new Error('Percorso media non valido.');
  }
}

function getStorageInfoSize(info: unknown): number | null {
  const record = (info ?? {}) as Record<string, unknown>;
  const metadata = (record.metadata ?? {}) as Record<string, unknown>;
  const rawSize = record.size ?? metadata.size ?? metadata.contentLength;
  const size = typeof rawSize === 'number' ? rawSize : Number(rawSize);
  return Number.isFinite(size) ? size : null;
}

function getStorageInfoContentType(info: unknown): string | null {
  const record = (info ?? {}) as Record<string, unknown>;
  const metadata = (record.metadata ?? {}) as Record<string, unknown>;
  const raw =
    record.contentType ??
    record.content_type ??
    metadata.mimetype ??
    metadata.mimeType ??
    metadata.contentType ??
    metadata.content_type;
  const value = normalizeMimeType(String(raw ?? ''));
  return value || null;
}

async function registerUploadedMediaForBooking(args: {
  booking: Omit<BookingMediaUploadRow, 'booking_dogs'>;
  caption?: string | null;
  staffUserId: string;
  storagePath: string;
  mediaType: CustomerMediaType;
}): Promise<CustomerMediaRow> {
  const { data: existingData, error: existingError } = await supabaseAdmin
    .from('customer_media')
    .select('*')
    .eq('storage_path', args.storagePath)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingData) {
    return castMediaRow(existingData);
  }

  const { data, error } = await supabaseAdmin
    .from('customer_media')
    .insert({
      user_id: args.booking.user_id,
      booking_id: args.booking.id,
      media_type: args.mediaType,
      storage_path: args.storagePath,
      caption: String(args.caption ?? '').trim() || null,
      visible_until: computeVisibleUntil(args.booking.end_date ?? args.booking.start_date, args.booking.departure_time),
      created_by_staff_user_id: args.staffUserId,
    })
    .select('*')
    .single();

  if (error || !data) {
    await supabaseAdmin.storage.from(CUSTOMER_MEDIA_BUCKET).remove([args.storagePath]).catch(() => undefined);
    throw new Error(error?.message ?? 'Non siamo riusciti a registrare il media.');
  }

  try {
    await createUserNotificationIfEnabled({
      userId: args.booking.user_id,
      type: 'MEDIA_AVAILABLE',
      title: args.mediaType === 'VIDEO' ? 'Nuovo video disponibile' : 'Nuova foto disponibile',
      body: 'Abbiamo caricato un nuovo contenuto del tuo cane nella sezione I tuoi media.',
      data: {
        href: '/profile',
        bookingId: args.booking.id,
      },
    });
  } catch (notificationError) {
    console.error('Customer media notification failed:', notificationError);
  }

  return castMediaRow(data);
}

export async function createSignedMediaUploadForBooking(args: {
  bookingId: string;
  fileName?: string | null;
  mimeType: string;
  size: number;
}): Promise<{
  bucket: string;
  storagePath: string;
  signedUrl: string;
  token: string;
}> {
  const mimeType = normalizeMimeType(args.mimeType);
  const validationError = validateCustomerMediaMetadata({ mimeType, size: args.size });
  if (validationError) {
    throw new Error(validationError);
  }

  const booking = await getBookingForMediaUpload(args.bookingId);
  const ext = guessMediaExtensionFromMetadata({ mimeType, fileName: args.fileName });
  const storagePath = buildMediaPath({
    userId: booking.user_id,
    bookingId: booking.id,
    ext,
  });

  const { data, error } = await supabaseAdmin.storage
    .from(CUSTOMER_MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data) {
    throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a preparare il caricamento del media.'));
  }

  return {
    bucket: CUSTOMER_MEDIA_BUCKET,
    storagePath: data.path || storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

export async function completeSignedMediaUploadForBooking(args: {
  bookingId: string;
  caption?: string | null;
  staffUserId: string;
  storagePath: string;
  mimeType?: string | null;
  size?: number | null;
}): Promise<CustomerMediaRow> {
  const booking = await getBookingForMediaUpload(args.bookingId);
  const storagePath = String(args.storagePath ?? '').trim();
  assertStoragePathMatchesBooking({ storagePath, booking });

  const { data: info, error: infoError } = await supabaseAdmin.storage
    .from(CUSTOMER_MEDIA_BUCKET)
    .info(storagePath);

  if (infoError || !info) {
    throw new Error(humanizeErrorMessage(infoError, 'Non siamo riusciti a verificare il media caricato.'));
  }

  const objectSize = getStorageInfoSize(info) ?? (args.size != null ? Number(args.size) : 0);
  const objectMimeType = getStorageInfoContentType(info) ?? normalizeMimeType(args.mimeType);
  const validationError = validateCustomerMediaMetadata({ mimeType: objectMimeType, size: objectSize });
  if (validationError) {
    await supabaseAdmin.storage.from(CUSTOMER_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(validationError);
  }

  const { data: downloadedMedia, error: downloadError } = await supabaseAdmin.storage
    .from(CUSTOMER_MEDIA_BUCKET)
    .download(storagePath);

  if (downloadError || !downloadedMedia) {
    throw new Error(humanizeErrorMessage(downloadError, 'Non siamo riusciti a verificare il media caricato.'));
  }

  const downloadedSizeError = validateCustomerMediaMetadata({
    mimeType: objectMimeType,
    size: downloadedMedia.size,
  });
  if (downloadedSizeError) {
    await supabaseAdmin.storage.from(CUSTOMER_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(downloadedSizeError);
  }

  const headerBytes = new Uint8Array(await downloadedMedia.slice(0, 16).arrayBuffer());
  const signatureError = validateUploadBytes({ type: objectMimeType }, headerBytes);
  if (signatureError) {
    await supabaseAdmin.storage.from(CUSTOMER_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(signatureError);
  }

  return registerUploadedMediaForBooking({
    booking,
    caption: args.caption,
    staffUserId: args.staffUserId,
    storagePath,
    mediaType: getMediaTypeFromMimeType(objectMimeType),
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

  const booking = await getBookingForMediaUpload(args.bookingId);

  const ext = guessMediaExtension(args.file);
  const storagePath = buildMediaPath({
    userId: booking.user_id,
    bookingId: booking.id,
    ext,
  });

  const mediaType = getMediaTypeFromFile(args.file);
  const headerBytes = new Uint8Array(await args.file.slice(0, 16).arrayBuffer());
  const signatureError = validateUploadBytes(args.file, headerBytes);
  if (signatureError) {
    throw new Error(signatureError);
  }

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

  return registerUploadedMediaForBooking({
    booking,
    caption: args.caption,
    staffUserId: args.staffUserId,
    storagePath,
    mediaType,
  });
}
