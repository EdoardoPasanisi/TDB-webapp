import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  AccommodationInputError,
  assertAccommodationKey,
  sanitizeAccommodationInput,
  setAccommodationActive,
  updateAccommodation,
} from '@/lib/services/pensione/accommodationsServer';

type Context = { params: Promise<{ key: string }> };

// Modifica nome/prezzi/climatizzazione, oppure ripristina un alloggio eliminato ({ active: true }).
export async function PATCH(request: Request, context: Context) {
  try {
    await requireStaffAccess(request, 'manage');
    const key = assertAccommodationKey((await context.params).key);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (body && Object.keys(body).length === 1 && typeof body.active === 'boolean') {
      await setAccommodationActive(key, body.active);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(await updateAccommodation(key, sanitizeAccommodationInput(body)));
  } catch (error) {
    if (error instanceof AccommodationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}

// Elimina = archivia (le prenotazioni passate continuano a riferirsi a questo alloggio).
export async function DELETE(request: Request, context: Context) {
  try {
    await requireStaffAccess(request, 'manage');
    const key = assertAccommodationKey((await context.params).key);
    await setAccommodationActive(key, false);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccommodationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}
