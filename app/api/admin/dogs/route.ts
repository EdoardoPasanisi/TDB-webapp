import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { searchAdminDogs } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { sanitizeSearchQuery } from '@/lib/admin/validation';

export async function GET(request: Request) {
  try {
    const access = await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const query = sanitizeSearchQuery(searchParams.get('q') ?? '');
    const dogs = await searchAdminDogs(query, 50, access.canManage ? 'full' : 'limited');

    return NextResponse.json({ items: dogs });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
