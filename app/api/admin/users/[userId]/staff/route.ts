import { NextResponse } from 'next/server';
import { getStaffRoleForUser, requireStaffAccess } from '@/lib/admin/auth';
import { setAdminUserStaffRole } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeStaffRoleUpdateInput } from '@/lib/admin/validation';

export async function PUT(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const access = await requireStaffAccess(request, 'manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');

    // Nessuno può modificare il proprio ruolo staff (anti-lockout).
    if (normalizedUserId === access.userId) {
      return NextResponse.json(
        { error: 'Non puoi modificare il tuo stesso ruolo staff.' },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
    const nextRole = sanitizeStaffRoleUpdateInput(body?.role);

    // Un ADMIN può gestire solo i membri "Sola lettura"; gli amministratori (ADMIN/SUPER)
    // sono gestibili solo dal SUPER_ADMIN.
    if (!access.canManageStaff) {
      const currentRole = await getStaffRoleForUser(normalizedUserId);
      if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Solo un Amministratore plus può modificare un amministratore.' },
          { status: 403 }
        );
      }
      if (nextRole && nextRole !== 'VIEWER') {
        return NextResponse.json(
          { error: 'Solo un Amministratore plus può assegnare ruoli amministrativi.' },
          { status: 403 }
        );
      }
    }

    const role = await setAdminUserStaffRole({ userId: normalizedUserId, role: nextRole });
    return NextResponse.json({ role });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
