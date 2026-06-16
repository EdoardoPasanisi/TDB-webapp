import { NextResponse } from 'next/server';
import { getStaffRoleForUser, requireStaffAccess } from '@/lib/admin/auth';
import { listAdminStaffMembers, upsertAdminStaffMember } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { sanitizeStaffMemberInput } from '@/lib/admin/validation';

export async function GET() {
  try {
    await requireStaffAccess('manage');
    const items = await listAdminStaffMembers();
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess(request, 'manage');

    const body = await request.json().catch(() => null);
    const input = sanitizeStaffMemberInput(body);

    if (input.userId === access.userId) {
      return NextResponse.json(
        { error: 'Non puoi modificare il tuo stesso ruolo staff.' },
        { status: 400 }
      );
    }

    // Un ADMIN può gestire solo i membri "Sola lettura": non può creare/declassare
    // altri ADMIN o Amministratori plus. Solo il SUPER_ADMIN gestisce gli admin.
    if (!access.canManageStaff) {
      if (input.role !== 'VIEWER') {
        return NextResponse.json(
          { error: 'Solo un Amministratore plus può assegnare ruoli amministrativi.' },
          { status: 403 }
        );
      }
      const currentRole = await getStaffRoleForUser(input.userId);
      if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Solo un Amministratore plus può modificare un amministratore.' },
          { status: 403 }
        );
      }
    }

    const member = await upsertAdminStaffMember(input);

    return NextResponse.json(member);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
