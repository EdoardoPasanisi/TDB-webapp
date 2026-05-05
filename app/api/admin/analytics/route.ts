import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminAnalytics } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

export async function GET() {
  try {
    await requireStaffAccess('view');
    const analytics = await getAdminAnalytics();
    return NextResponse.json(analytics);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
