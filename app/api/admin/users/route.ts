import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { searchAdminUsers } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { sanitizeSearchQuery } from '@/lib/admin/validation';

export async function GET(request: Request) {
  try {
    const access = await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const query = sanitizeSearchQuery(searchParams.get('q') ?? '');
    const users = await searchAdminUsers(query, 40, access.canManage ? 'full' : 'limited');

    return NextResponse.json({ items: users });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
