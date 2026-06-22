import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { completeSignedMediaUploadForBooking } from '@/lib/media/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess(request, 'view');
    const body = (await request.json().catch(() => null)) as {
      bookingId?: unknown;
      caption?: unknown;
      storagePath?: unknown;
      mimeType?: unknown;
      size?: unknown;
    } | null;

    const bookingId = assertUuid(String(body?.bookingId ?? '').trim(), 'Prenotazione');
    const media = await completeSignedMediaUploadForBooking({
      bookingId,
      caption: String(body?.caption ?? '').trim() || null,
      staffUserId: access.userId,
      storagePath: String(body?.storagePath ?? '').trim(),
      mimeType: String(body?.mimeType ?? '').trim(),
      size: Number(body?.size ?? 0),
    });

    return NextResponse.json({ ok: true, media });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
