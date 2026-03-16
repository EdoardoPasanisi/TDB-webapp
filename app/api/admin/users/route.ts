import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { searchAdminUsers } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? '';
    const users = await searchAdminUsers(query);

    return NextResponse.json({ items: users });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
