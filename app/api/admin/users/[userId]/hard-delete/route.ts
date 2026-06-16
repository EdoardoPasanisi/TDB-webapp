import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { hardDeleteAdminUser } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';

// Eliminazione definitiva (auth.users + dati collegati). Consentita solo su utenti
// già soft-deleted, dalla pagina "Utenti eliminati".
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    await hardDeleteAdminUser(normalizedUserId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
