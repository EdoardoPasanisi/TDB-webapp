import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { listVisibleMediaForBooking } from '@/lib/media/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ bookingId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireStaffAccess('view');
    const { bookingId } = await context.params;
    const normalizedBookingId = assertUuid(String(bookingId ?? '').trim(), 'Prenotazione');
    const items = await listVisibleMediaForBooking(normalizedBookingId);
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
