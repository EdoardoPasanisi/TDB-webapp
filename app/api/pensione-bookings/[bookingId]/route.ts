import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeUuid } from '@/lib/services/pensione/parseInput';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Eliminazione definitiva di una prenotazione pensione da parte del cliente
// proprietario. Se la prenotazione era "a saldo" (CONFIRMED/COMPLETED) storna il
// totale dal wallet, coerentemente con l'eliminazione lato gestionale.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { userId } = await requireRequestUser(request);
    const { bookingId: bookingIdParam } = await context.params;
    const bookingId = normalizeUuid(bookingIdParam);
    if (!bookingId) {
      return NextResponse.json({ error: 'Prenotazione non valida.' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, user_id, service_type, status, total_price')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .maybeSingle();

    if (bookingError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(bookingError, 'Non siamo riusciti a eliminare la prenotazione.') },
        { status: 400 }
      );
    }
    if (!booking || booking.service_type !== 'PENSIONE') {
      return NextResponse.json({ error: 'Prenotazione non trovata.' }, { status: 404 });
    }

    const status = String(booking.status ?? '');
    const wasOutstanding = status === 'CONFIRMED' || status === 'COMPLETED';
    const total = Number((booking as { total_price?: number | null }).total_price ?? 0);
    if (wasOutstanding && Number.isFinite(total) && total > 0) {
      await supabaseAdmin.rpc('add_wallet_due', { p_user_id: userId, p_amount_eur: -total });
    }

    await supabaseAdmin.from('booking_dogs').delete().eq('booking_id', bookingId);
    const { error: deleteError } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', bookingId)
      .eq('user_id', userId);

    if (deleteError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(deleteError, 'Non siamo riusciti a eliminare la prenotazione.') },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per eliminare la prenotazione.') },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Si è verificato un problema. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
