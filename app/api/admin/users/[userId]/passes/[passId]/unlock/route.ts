import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { unlockAdminServicePass } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string; passId: string }> }
) {
  try {
    const access = await requireStaffAccess('manage');
    const { userId, passId } = await context.params;

    const updatedPass = await unlockAdminServicePass({
      userId: assertUuid(userId, 'Utente'),
      passId: assertUuid(passId, 'Pacchetto crediti'),
      staffUserId: access.userId,
    });

    return NextResponse.json(updatedPass);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
