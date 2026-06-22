import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { createMediaUploadForBooking } from '@/lib/media/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request, 'view');
    const body = (await request.json().catch(() => null)) as {
      bookingId?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
      size?: unknown;
    } | null;

    const bookingId = assertUuid(String(body?.bookingId ?? '').trim(), 'Prenotazione');
    const upload = await createMediaUploadForBooking({
      bookingId,
      fileName: String(body?.fileName ?? '').trim() || null,
      mimeType: String(body?.mimeType ?? '').trim(),
      size: Number(body?.size ?? 0),
    });

    return NextResponse.json({ ok: true, upload });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
