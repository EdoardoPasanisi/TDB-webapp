import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  AccommodationInputError,
  createAccommodation,
  loadAccommodationCatalog,
  sanitizeAccommodationInput,
} from '@/lib/services/pensione/accommodationsServer';

// Catalogo completo, compresi gli alloggi eliminati (servono per le prenotazioni esistenti).
export async function GET() {
  try {
    await requireStaffAccess('view');
    return NextResponse.json({ items: await loadAccommodationCatalog() });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');
    const input = sanitizeAccommodationInput(await request.json().catch(() => null));
    return NextResponse.json(await createAccommodation(input));
  } catch (error) {
    if (error instanceof AccommodationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}
