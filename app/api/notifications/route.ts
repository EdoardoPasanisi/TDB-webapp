import { NextResponse } from 'next/server';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import {
  countUnreadNotificationsForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
} from '@/lib/notifications/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';

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
    const access = await requireRequestUser(request);
    const limit = readPositiveLimit(request);

    const [items, unreadCount] = await Promise.all([
      listNotificationsForUser({ userId: access.userId, limit }),
      countUnreadNotificationsForUser(access.userId),
    ]);

    return NextResponse.json({ ok: true, items, unreadCount });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { ok: false, error: humanizeErrorMessage(error, 'Non siamo riusciti a caricare le notifiche.') },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = typeof body?.action === 'string' ? body.action.trim() : '';

    if (action !== 'mark_all_read') {
      return NextResponse.json({ ok: false, error: 'Azione non valida.' }, { status: 400 });
    }

    await markAllNotificationsReadForUser(access.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { ok: false, error: humanizeErrorMessage(error, 'Non siamo riusciti ad aggiornare le notifiche.') },
      { status: 500 }
    );
  }
}
