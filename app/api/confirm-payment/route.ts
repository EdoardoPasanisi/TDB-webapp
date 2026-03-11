/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { ok: false, message: 'Stripe non configurato: manca STRIPE_SECRET_KEY in .env.local.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ ok: false, message: 'session_id mancante.' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // ✅ Verifica che Stripe consideri la sessione pagata
    // (payment_status: 'paid' quando il pagamento è stato completato)
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ ok: false, message: 'Pagamento non completato.' }, { status: 400 });
    }

    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      return NextResponse.json(
        { ok: false, message: 'bookingId mancante nei metadata Stripe.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'PAID',
        stripe_session_id: session.id,
        total_amount_cents: session.amount_total ?? null,
      })
      .eq('id', bookingId);

    if (error) {
      return NextResponse.json(
        { ok: false, message: 'Pagamento ok, ma errore aggiornando lo stato prenotazione.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Pagamento riuscito e prenotazione aggiornata.' });
  } catch (error: any) {
    console.error('Errore in /api/confirm-payment:', error);
    return NextResponse.json(
      { ok: false, message: 'Pagamento ok, ma errore aggiornando lo stato prenotazione.' },
      { status: 500 }
    );
  }
}
