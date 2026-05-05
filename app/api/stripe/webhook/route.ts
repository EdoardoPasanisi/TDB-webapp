import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { confirmStripeCheckoutSession, getStripeServerClient } from '@/lib/server/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANDLED_EVENT_TYPES = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

export async function POST(request: Request) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    console.error('Errore webhook Stripe: manca STRIPE_WEBHOOK_SECRET.');
    return NextResponse.json({ error: 'Webhook Stripe non configurato.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Firma Stripe mancante.' }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeServerClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('Errore verifica webhook Stripe:', error);
    return NextResponse.json({ error: 'Firma webhook non valida.' }, { status: 400 });
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  if (!checkoutSession || typeof checkoutSession.id !== 'string') {
    return NextResponse.json({ error: 'Payload webhook non valido.' }, { status: 400 });
  }

  try {
    const result = await confirmStripeCheckoutSession(checkoutSession.id);
    return NextResponse.json({
      received: true,
      bookingId: result.bookingId,
      alreadyPaid: result.alreadyPaid,
    });
  } catch (error) {
    console.error(`Errore gestione webhook Stripe ${event.type}:`, error);
    return NextResponse.json({ error: 'Errore elaborando il webhook Stripe.' }, { status: 500 });
  }
}
