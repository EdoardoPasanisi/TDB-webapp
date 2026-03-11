/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // ✅ Richiede sessione valida (passata dal client come Bearer token)
    const authHeader = req.headers.get('authorization') ?? '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1] ?? null;
    if (!accessToken) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Sessione non valida.' }, { status: 401 });
    }

    const userId = userData.user.id;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe non configurato: manca STRIPE_SECRET_KEY in .env.local.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const body = await req.json().catch(() => null);
    if (!body?.bookingId) {
      return NextResponse.json({ error: 'bookingId mancante.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 });
    }

    // ✅ Evitiamo di creare checkout per booking già pagati / cancellati
    if (booking.status === 'PAID' || booking.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Prenotazione non pagabile nello stato attuale.' },
        { status: 400 }
      );
    }

    const totalPriceEuro = typeof booking.total_price === 'number' ? booking.total_price : 0;
    const unitAmountCents = Math.max(0, Math.round(totalPriceEuro * 100));

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
      success_url: `${
        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      }/payments-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/payments-cancel`,
      metadata: { bookingId },
    });

    // ✅ Persistiamo session_id e amount in cents (best effort)
    const amountCents = session.amount_total ?? unitAmountCents;
    await supabaseAdmin
      .from('bookings')
      .update({ stripe_session_id: session.id, total_amount_cents: amountCents })
      .eq('id', bookingId);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Errore creazione sessione Stripe:', error);
    return NextResponse.json({ error: error?.message ?? 'Errore interno' }, { status: 500 });
  }
}
