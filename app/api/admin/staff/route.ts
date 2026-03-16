import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { listAdminStaffMembers, upsertAdminStaffMemberByEmail } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import type { StaffRole } from '@/lib/admin/types';

export async function GET() {
  try {
    await requireStaffAccess('view');
    const items = await listAdminStaffMembers();
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess('manage');

    const body = (await request.json().catch(() => null)) as
      | { email?: string; role?: StaffRole; isActive?: boolean }
      | null;

    if (!body?.email || !body.role) {
      return NextResponse.json({ error: 'Email o ruolo mancanti.' }, { status: 400 });
    }

    const member = await upsertAdminStaffMemberByEmail({
      email: body.email,
      role: body.role,
      isActive: body.isActive ?? true,
    });

    return NextResponse.json(member);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
