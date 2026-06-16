import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { setAdminUserDeleted } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';

// Ripristina un utente soft-deleted.
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    await setAdminUserDeleted(normalizedUserId, false);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
