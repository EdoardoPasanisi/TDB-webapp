import { NextRequest, NextResponse } from 'next/server';
import { confirmStripeCheckoutSession } from '@/lib/server/payments';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireRequestUser(req);

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ ok: false, message: 'Manca il riferimento del pagamento.' }, { status: 400 });
    }

    const result = await confirmStripeCheckoutSession(sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Errore in /api/confirm-payment:', error);

    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        {
          ok: false,
          message: humanizeErrorMessage(
            error.message,
            'Devi accedere per verificare il pagamento.'
          ),
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: humanizeErrorMessage(
          error,
          'Il pagamento risulta eseguito, ma non siamo riusciti ad aggiornare subito la prenotazione.'
        ),
      },
      { status: 500 }
    );
  }
}
