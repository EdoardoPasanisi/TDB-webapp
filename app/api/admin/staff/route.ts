import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { listAdminStaffMembers, upsertAdminStaffMember } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { sanitizeStaffMemberInput } from '@/lib/admin/validation';

export async function GET() {
  try {
    await requireStaffAccess('super');
    const items = await listAdminStaffMembers();
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess(request, 'super');

    const body = await request.json().catch(() => null);
    const input = sanitizeStaffMemberInput(body);

    if (input.userId === access.userId) {
      return NextResponse.json(
        { error: 'Non puoi modificare il tuo stesso ruolo staff.' },
        { status: 400 }
      );
    }

    const member = await upsertAdminStaffMember(input);

    return NextResponse.json(member);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
