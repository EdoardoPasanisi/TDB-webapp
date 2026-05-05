import { NextResponse } from 'next/server';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { markNotificationReadForUser } from '@/lib/notifications/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireRequestUser(request);
    const { notificationId } = await context.params;
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = typeof body?.action === 'string' ? body.action.trim() : '';

    if (action !== 'mark_read') {
      return NextResponse.json({ ok: false, error: 'Azione non valida.' }, { status: 400 });
    }

    await markNotificationReadForUser({
      notificationId,
      userId: access.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { ok: false, error: humanizeErrorMessage(error, 'Non siamo riusciti ad aggiornare la notifica.') },
      { status: 500 }
    );
  }
}
