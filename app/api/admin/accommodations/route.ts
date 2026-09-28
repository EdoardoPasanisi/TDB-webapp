import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  AccommodationInputError,
  createAccommodation,
  loadAccommodationCatalog,
  sanitizeAccommodationInput,
  setClimateForAllAccommodations,
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

// Interruttore generale: { climateActive: boolean } su tutti gli alloggi.
export async function PATCH(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');
    const body = (await request.json().catch(() => null)) as { climateActive?: unknown } | null;
    if (typeof body?.climateActive !== 'boolean') {
      return NextResponse.json({ error: 'Valore non valido.' }, { status: 400 });
    }
    await setClimateForAllAccommodations(body.climateActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
