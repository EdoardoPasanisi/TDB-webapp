import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminBookingDetail, updateAdminBookingStatus } from '@/lib/admin/data';
import { createUserNotificationIfEnabled } from '@/lib/notifications/server';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeBookingStatusPatchInput } from '@/lib/admin/validation';
import { serviceLabel, statusLabel } from '@/lib/services/formatters';

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; bookingId: string }> }
) {
  try {
    const access = await requireStaffAccess('view');

    const { kind, bookingId } = await context.params;
    const normalizedBookingId = assertUuid(bookingId, 'Prenotazione');
    const normalizedKind = String(kind ?? '').toLowerCase();
    if (normalizedKind !== 'pensione' && normalizedKind !== 'service-slot') {
      return NextResponse.json({ error: 'Tipo prenotazione non valido.' }, { status: 400 });
    }
    const detail = await getAdminBookingDetail(
      normalizedKind === 'service-slot' ? 'SERVICE_SLOT' : 'PENSIONE',
      normalizedBookingId,
      access.canManage ? 'full' : 'limited'
    );

    if (!detail) {
      return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ kind: string; bookingId: string }> }
) {
  try {
    await requireStaffAccess('manage');

    const { kind, bookingId } = await context.params;
    const normalizedBookingId = assertUuid(bookingId, 'Prenotazione');
    const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
    const parsed = sanitizeBookingStatusPatchInput(kind, body?.status);

    const updated = await updateAdminBookingStatus({
      kind: parsed.kind,
      bookingId: normalizedBookingId,
      status: parsed.status,
    });

    if (updated.previousStatus !== updated.status) {
      const serviceName = serviceLabel(updated.serviceType as Parameters<typeof serviceLabel>[0]);
      await createUserNotificationIfEnabled({
        userId: updated.userId,
        type: 'BOOKING_STATUS',
        title: 'Aggiornamento prenotazione',
        body: `La tua prenotazione ${serviceName} è ora ${statusLabel(
          updated.status as Parameters<typeof statusLabel>[0]
        ).toLowerCase()}.`,
        data: {
          href: `/services/booking/${normalizedBookingId}`,
          bookingId: normalizedBookingId,
          bookingKind: parsed.kind,
          status: updated.status,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
