import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminUserDetail, updateAdminUserProfile } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeProfilePatch } from '@/lib/admin/validation';

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const access = await requireStaffAccess('view');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    const detail = await getAdminUserDetail(normalizedUserId, access.canManage ? 'full' : 'limited');

    if (!detail) {
      return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess('manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    const profile = await updateAdminUserProfile(
      normalizedUserId,
      sanitizeProfilePatch(await request.json().catch(() => null))
    );
    return NextResponse.json(profile);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
