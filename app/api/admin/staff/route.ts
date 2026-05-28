import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
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
    await requireStaffAccess(request, 'manage');

    const body = await request.json().catch(() => null);
    const member = await upsertAdminStaffMember(sanitizeStaffMemberInput(body));

    return NextResponse.json(member);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
