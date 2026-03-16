import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { updateAdminBookingStatus } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import type { AdminBookingKind } from '@/lib/admin/types';
import type { BookingStatus } from '@/types/booking';
import type { ServiceStatus } from '@/types/services';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ kind: string; bookingId: string }> }
) {
  try {
    await requireStaffAccess('manage');

    const { kind, bookingId } = await context.params;
    const normalizedKind = kind === 'service-slot' ? 'SERVICE_SLOT' : 'PENSIONE';
    const body = (await request.json().catch(() => null)) as { status?: BookingStatus | ServiceStatus } | null;

    if (!body?.status) {
      return NextResponse.json({ error: 'Status prenotazione mancante.' }, { status: 400 });
    }

    await updateAdminBookingStatus({
      kind: normalizedKind as AdminBookingKind,
      bookingId,
      status: body.status,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
