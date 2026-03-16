import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminDateView } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

function fallbackDate(offsetDays = 0): string {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start') ?? fallbackDate(0);
    const endDate = searchParams.get('end') ?? startDate;
    const status = searchParams.get('status') ?? 'ALL';

    const payload = await getAdminDateView({ startDate, endDate, status });
    return NextResponse.json(payload);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
