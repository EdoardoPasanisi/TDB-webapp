import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminOverview } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

export async function GET() {
  try {
    const access = await requireStaffAccess('view');
    const overview = await getAdminOverview(access.canManage ? 'full' : 'limited');
    return NextResponse.json(overview);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
