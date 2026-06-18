import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getUnprintedPensioneBookingDetails, markPensioneBookingsPrinted } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

// Coda di stampa: prenotazioni pensione non ancora stampate.
export async function GET() {
  try {
    await requireStaffAccess('manage');
    const items = await getUnprintedPensioneBookingDetails();
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

// Segna come stampate le prenotazioni indicate.
export async function POST(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');
    const body = (await request.json().catch(() => null)) as { bookingIds?: unknown } | null;
    const ids = Array.isArray(body?.bookingIds)
      ? body.bookingIds.map((value) => String(value)).filter(Boolean)
      : [];
    await markPensioneBookingsPrinted(ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
