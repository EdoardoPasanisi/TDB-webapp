import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminDateView } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { sanitizeAdminStatusInput, sanitizeDateRangeInput } from '@/lib/admin/validation';

function fallbackDate(offsetDays = 0): string {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const access = await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = sanitizeDateRangeInput(
      searchParams.get('start') ?? fallbackDate(0),
      searchParams.get('end') ?? searchParams.get('start') ?? fallbackDate(0)
    );
    const status = sanitizeAdminStatusInput(searchParams.get('status') ?? 'ALL');

    const payload = await getAdminDateView({
      startDate,
      endDate,
      status,
      visibility: access.canManage ? 'full' : 'limited',
    });
    return NextResponse.json(payload);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
