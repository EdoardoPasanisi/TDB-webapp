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
    const access = await requireStaffAccess(request, 'super');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');

    // Un Amministratore plus non può togliersi/declassarsi da solo (anti-lockout).
    if (normalizedUserId === access.userId) {
      return NextResponse.json(
        { error: 'Non puoi modificare il tuo stesso ruolo staff.' },
        { status: 400 }
      );
    }

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
