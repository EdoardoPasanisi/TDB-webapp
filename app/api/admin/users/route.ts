import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { listDeletedAdminUsers, searchAdminUsers } from '@/lib/admin/data';
import { createAdminUser } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';
import { sanitizeCreateUserInput, sanitizeSearchQuery } from '@/lib/admin/validation';

export async function GET(request: Request) {
  try {
    const access = await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);

    if (searchParams.get('status') === 'deleted') {
      if (!access.canManage) {
        return NextResponse.json({ items: [] });
      }
      const deleted = await listDeletedAdminUsers();
      return NextResponse.json({ items: deleted });
    }

    const query = sanitizeSearchQuery(searchParams.get('q') ?? '');
    const users = await searchAdminUsers(query, 40, access.canManage ? 'full' : 'limited');

    return NextResponse.json({ items: users });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');

    const input = sanitizeCreateUserInput(await request.json().catch(() => null));
    const result = await createAdminUser(input);

    return NextResponse.json({
      userId: result.userId,
      profile: result.profile,
      tempPassword: result.tempPassword,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
