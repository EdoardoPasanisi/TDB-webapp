import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { updateAdminPensioneBookingFull, updateAdminSlotBookingFull } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeAdminSlotBookingEditInput } from '@/lib/admin/validation';
import { parsePensioneBookingInput } from '@/lib/services/pensione/parseInput';

// Edit COMPLETO di una prenotazione lato gestionale (qualsiasi user_id).
// - pensione: ricalcola il prezzo e riconcilia il saldo (delta nuovo-vecchio).
// - service-slot: cambia slot/cane/taxi/note con controllo capienza.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ kind: string; bookingId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { kind, bookingId } = await context.params;
    const normalizedBookingId = assertUuid(bookingId, 'Prenotazione');
    const normalizedKind = String(kind ?? '').toLowerCase();

    const body = await request.json().catch(() => null);

    if (normalizedKind === 'pensione') {
      const input = parsePensioneBookingInput(body);
      if (!input) {
        return NextResponse.json({ error: 'Payload prenotazione non valido.' }, { status: 400 });
      }
      const result = await updateAdminPensioneBookingFull(normalizedBookingId, input);
      return NextResponse.json(result);
    }

    if (normalizedKind === 'service-slot') {
      const input = sanitizeAdminSlotBookingEditInput(body);
      const result = await updateAdminSlotBookingFull(normalizedBookingId, {
        slotId: input.slotId,
        dogId: input.dogId,
        taxiEnabled: input.taxiEnabled,
        taxiDistanceKm: input.taxiDistanceKm,
        taxiPriceEur: input.taxiPriceEur,
        notes: input.notes,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Tipo prenotazione non valido.' }, { status: 400 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
