import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { getMediaDownloadForUser } from '@/lib/media/server';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const access = await requireRequestUser(request);
    const { mediaId } = await context.params;
    const normalizedMediaId = String(mediaId ?? '').trim();

    if (!normalizedMediaId) {
      return NextResponse.json({ ok: false, error: 'Media non valido.' }, { status: 400 });
    }

    const result = await getMediaDownloadForUser({ userId: access.userId, mediaId: normalizedMediaId });

    if (result.status === 'not_found') {
      return NextResponse.json({ ok: false, error: 'Media non trovato.' }, { status: 404 });
    }

    if (result.status === 'preparing') {
      return NextResponse.json(
        { ok: false, status: 'preparing', error: 'Il download del video è in preparazione. Riprova tra qualche minuto.' },
        { status: 202 }
      );
    }

    return NextResponse.json({ ok: true, url: result.url });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { ok: false, error: humanizeErrorMessage(error, 'Non siamo riusciti a preparare il download.') },
      { status: 500 }
    );
  }
}
