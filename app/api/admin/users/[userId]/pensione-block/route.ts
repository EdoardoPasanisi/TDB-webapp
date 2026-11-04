import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { setPensioneUserBlocked } from '@/lib/admin/pensioneBlocks';
import { assertUuid, sanitizePensioneUserBlockInput } from '@/lib/admin/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Blocca/sblocca un cliente per le prenotazioni pensione: se bloccato, in fase di
// prenotazione vede l'avviso "non c'è posto" per qualsiasi periodo.
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const access = await requireStaffAccess(request, 'manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    const input = sanitizePensioneUserBlockInput(await request.json().catch(() => null));

    const result = await setPensioneUserBlocked({
      userId: normalizedUserId,
      blocked: input.blocked,
      notes: input.notes,
      createdBy: access.userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
