import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { removeAdminServicePass } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';

// Annulla un pacchetto/credito del cliente.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string; passId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { userId, passId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    const normalizedPassId = assertUuid(passId, 'Pacchetto');

    await removeAdminServicePass({ userId: normalizedUserId, passId: normalizedPassId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
