import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  countUnreadStaffNotificationsForUser,
  listStaffNotificationsForUser,
  markAllStaffNotificationsReadForUser,
} from '@/lib/admin/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readPositiveLimit(request: Request): number {
  const { searchParams } = new URL(request.url);
  const raw = Number(searchParams.get('limit') ?? 12);
  if (!Number.isFinite(raw)) return 12;
  return Math.min(30, Math.max(1, Math.trunc(raw)));
}

export async function GET(request: Request) {
  try {
    const access = await requireStaffAccess('view');
    const limit = readPositiveLimit(request);

    const [items, unreadCount] = await Promise.all([
      listStaffNotificationsForUser({ userId: access.userId, limit }),
      countUnreadStaffNotificationsForUser(access.userId),
    ]);

    return NextResponse.json({ ok: true, items, unreadCount });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireStaffAccess('view');
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = typeof body?.action === 'string' ? body.action.trim() : '';

    if (action !== 'mark_all_read') {
      return NextResponse.json({ ok: false, error: 'Azione non valida.' }, { status: 400 });
    }

    await markAllStaffNotificationsReadForUser(access.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
