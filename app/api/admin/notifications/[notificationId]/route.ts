import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { markStaffNotificationReadForUser } from '@/lib/admin/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireStaffAccess('view');
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = typeof body?.action === 'string' ? body.action.trim() : '';

    if (action !== 'mark_read') {
      return NextResponse.json({ ok: false, error: 'Azione non valida.' }, { status: 400 });
    }

    const { notificationId } = await context.params;
    await markStaffNotificationReadForUser({
      notificationId,
      userId: access.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
