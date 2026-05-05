import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type StripeBookingRow = {
  id: string;
  user_id: string;
  status: string | null;
  stripe_session_id: string | null;
  total_amount_cents: number | null;
};

export type ConfirmStripePaymentResult = {
  ok: boolean;
  message: string;
  bookingId: string;
  alreadyPaid: boolean;
};

export function getStripeServerClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('Stripe non configurato: manca STRIPE_SECRET_KEY in .env.local.');
  }

  return new Stripe(stripeSecretKey);
}

export async function confirmStripeCheckoutSession(sessionId: string): Promise<ConfirmStripePaymentResult> {
  const stripe = getStripeServerClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    throw new Error('Pagamento non completato.');
  }

  const bookingId = String(session.metadata?.bookingId ?? '').trim();
  const expectedUserId = String(session.metadata?.userId ?? '').trim();

  if (!bookingId) {
    throw new Error('bookingId mancante nei metadata Stripe.');
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, status, stripe_session_id, total_amount_cents')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    throw new Error('Prenotazione non trovata.');
  }

  const bookingRow = booking as StripeBookingRow;

  if (expectedUserId && bookingRow.user_id !== expectedUserId) {
    throw new Error('Mismatch tra sessione di pagamento e prenotazione.');
  }

  if (bookingRow.stripe_session_id && bookingRow.stripe_session_id !== session.id) {
    throw new Error('La prenotazione è associata a una sessione Stripe diversa.');
  }

  if (bookingRow.status === 'PAID' && bookingRow.stripe_session_id === session.id) {
    return {
      ok: true,
      message: 'Pagamento già confermato.',
      bookingId,
      alreadyPaid: true,
    };
  }

  if (!['PENDING', 'CONFIRMED'].includes(String(bookingRow.status ?? ''))) {
    throw new Error('La prenotazione non è in uno stato pagabile.');
  }

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'PAID',
      stripe_session_id: session.id,
      total_amount_cents: session.amount_total ?? bookingRow.total_amount_cents ?? null,
    })
    .eq('id', bookingId)
    .eq('user_id', bookingRow.user_id);

  if (error) {
    throw new Error('Pagamento ok, ma errore aggiornando lo stato prenotazione.');
  }

  return {
    ok: true,
    message: 'Pagamento riuscito e prenotazione aggiornata.',
    bookingId,
    alreadyPaid: false,
  };
}
