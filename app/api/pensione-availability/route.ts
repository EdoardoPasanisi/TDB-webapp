import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { RouteAuthError, requireRequestUser, routeAuthErrorResponse } from '@/lib/server/routeAuth';
import { findPensioneBlockConflict, formatBlockedPeriodsMessage } from '@/lib/admin/pensioneBlocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Verifica se il periodo richiesto è bloccato per l'utente corrente.
export async function GET(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);

    const { searchParams } = new URL(request.url);
    const startDate = String(searchParams.get('start') ?? '').trim();
    const endDate = String(searchParams.get('end') ?? '').trim();

    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || endDate < startDate) {
      return NextResponse.json({ error: 'Intervallo date non valido.' }, { status: 400 });
    }

    const conflict = await findPensioneBlockConflict({ userId, startDate, endDate });

    return NextResponse.json({
      blocked: conflict.blocked,
      periods: conflict.periods,
      message: conflict.blocked ? formatBlockedPeriodsMessage(conflict.periods) : null,
    });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per verificare la disponibilità.'),
      });
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a verificare la disponibilità.') },
      { status: 500 }
    );
  }
}
