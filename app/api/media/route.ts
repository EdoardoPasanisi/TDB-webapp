import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { listVisibleMediaForUser } from '@/lib/media/server';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await requireRequestUser(request);
    const items = await listVisibleMediaForUser(access.userId);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: humanizeErrorMessage(error, 'Non siamo riusciti a caricare i media.') },
      { status: 500 }
    );
  }
}
