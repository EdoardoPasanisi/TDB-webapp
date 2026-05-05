import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { listAdminMediaRecap, uploadMediaForBooking } from '@/lib/media/server';
import { assertUuid } from '@/lib/admin/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaffAccess('view');
    const items = await listAdminMediaRecap();
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess('manage');
    const formData = await request.formData();
    const bookingId = assertUuid(String(formData.get('bookingId') ?? '').trim(), 'Prenotazione');
    const caption = String(formData.get('caption') ?? '').trim() || null;
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Seleziona un file prima di continuare.' }, { status: 400 });
    }

    const media = await uploadMediaForBooking({
      bookingId,
      caption,
      staffUserId: access.userId,
      file,
    });

    return NextResponse.json({ ok: true, media });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
