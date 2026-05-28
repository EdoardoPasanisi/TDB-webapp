import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { setAdminUserStaffRole } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeStaffRoleUpdateInput } from '@/lib/admin/validation';

export async function PUT(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
    const role = await setAdminUserStaffRole({
      userId: normalizedUserId,
      role: sanitizeStaffRoleUpdateInput(body?.role),
    });
    return NextResponse.json({ role });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
