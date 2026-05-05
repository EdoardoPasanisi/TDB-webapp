import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { getRequestOrigin } from '@/lib/server/requestOrigin';
import { getStripeServerClient } from '@/lib/server/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireRequestUser(req);
    const stripe = getStripeServerClient();
    const requestOrigin = getRequestOrigin(req);

    const body = await req.json().catch(() => null);
    if (!body?.bookingId) {
      return NextResponse.json({ error: 'Manca il riferimento della prenotazione.' }, { status: 400 });
    }

    const bookingId = String(body.bookingId);

    // ✅ Selezioniamo SOLO colonne che esistono già nel tuo codice (booking detail page)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, service_type, total_price, status')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Prenotazione non trovata o errore nel recupero.' },
        { status: 404 }
      );
    }

    // ✅ Ownership check
    if (booking.user_id !== userId) {
      return NextResponse.json({ error: 'Non hai i permessi per pagare questa prenotazione.' }, { status: 403 });
    }

    // ✅ Consentiamo il checkout solo per booking effettivamente pagabili
    if (!['PENDING', 'CONFIRMED'].includes(String(booking.status ?? ''))) {
      return NextResponse.json(
        { error: 'Prenotazione non pagabile nello stato attuale.' },
        { status: 400 }
      );
    }

    const totalPriceEuro = typeof booking.total_price === 'number' ? booking.total_price : 0;
    const unitAmountCents = Math.max(0, Math.round(totalPriceEuro * 100));
    if (unitAmountCents <= 0) {
      return NextResponse.json(
        { error: 'Importo non valido per il pagamento online.' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Tenuta del Barone – ${booking.service_type ?? 'Servizio'}`,
            },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${requestOrigin}/payments-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${requestOrigin}/payments-cancel?booking_id=${encodeURIComponent(bookingId)}`,
      metadata: { bookingId, userId },
    });

    // ✅ Persistiamo session_id e amount in cents (best effort)
    const amountCents = session.amount_total ?? unitAmountCents;
    await supabaseAdmin
      .from('bookings')
      .update({ stripe_session_id: session.id, total_amount_cents: amountCents })
      .eq('id', bookingId);

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe non ha restituito un URL di checkout valido.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Errore creazione sessione Stripe:', error);

    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per continuare con il pagamento.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti ad avviare il pagamento online.') },
      { status: 500 }
    );
  }
}
