import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { searchAdminDogs } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? '';
    const dogs = await searchAdminDogs(query);

    return NextResponse.json({ items: dogs });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
