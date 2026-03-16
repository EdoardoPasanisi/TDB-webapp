import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminOverview } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

export async function GET() {
  try {
    await requireStaffAccess('view');
    const overview = await getAdminOverview();
    return NextResponse.json(overview);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
