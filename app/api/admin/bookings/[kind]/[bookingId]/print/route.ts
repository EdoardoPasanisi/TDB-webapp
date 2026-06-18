import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { markPensioneBookingPrinted } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';

// Segna una prenotazione pensione come "stampata". Solo kind === 'pensione'.
export async function POST(
  request: Request,
  context: { params: Promise<{ kind: string; bookingId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');
    const { kind, bookingId } = await context.params;
    if (String(kind ?? '').toLowerCase() !== 'pensione') {
      return NextResponse.json({ error: 'La stampa è disponibile solo per la pensione.' }, { status: 400 });
    }
    await markPensioneBookingPrinted(assertUuid(bookingId, 'Prenotazione'));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
