import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';

export async function GET() {
  try {
    const access = await requireStaffAccess('view');
    return NextResponse.json(access);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
