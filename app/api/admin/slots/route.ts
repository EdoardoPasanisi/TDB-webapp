import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { deleteAdminSlot, listAdminSlots, upsertAdminSlot } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  sanitizeDateRangeInput,
  sanitizeSlotDeleteInput,
  sanitizeServiceTypeOrAllInput,
  sanitizeSlotInput,
} from '@/lib/admin/validation';

function fallbackDate(offsetDays = 0): string {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = sanitizeDateRangeInput(
      searchParams.get('start') ?? fallbackDate(0),
      searchParams.get('end') ?? fallbackDate(30)
    );
    const serviceType = sanitizeServiceTypeOrAllInput(searchParams.get('serviceType') ?? 'ALL');

    const items = await listAdminSlots({
      startDate,
      endDate,
      serviceTypes: serviceType === 'ALL' ? 'ALL' : [serviceType],
    });
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess('manage');

    const body = await request.json().catch(() => null);
    const slot = await upsertAdminSlot(sanitizeSlotInput(body));

    return NextResponse.json(slot);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireStaffAccess('manage');

    const body = await request.json().catch(() => null);
    const { slotId } = sanitizeSlotDeleteInput(body);
    await deleteAdminSlot(slotId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
