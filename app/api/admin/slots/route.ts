import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { listAdminSlots, upsertAdminSlot } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import type { ServiceType, ServiceVariant } from '@/types/services';

function fallbackDate(offsetDays = 0): string {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start') ?? fallbackDate(0);
    const endDate = searchParams.get('end') ?? fallbackDate(30);
    const rawServiceType = searchParams.get('serviceType') ?? 'ALL';
    const serviceType = rawServiceType === 'ALL' ? 'ALL' : (rawServiceType as ServiceType);

    const items = await listAdminSlots({ startDate, endDate, serviceType });
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess('manage');

    const body = (await request.json().catch(() => null)) as null | {
      slotId?: string | null;
      serviceType?: ServiceType;
      serviceVariant?: ServiceVariant | null;
      startAt?: string;
      endAt?: string;
      capacity?: number;
      isActive?: boolean;
      notes?: string | null;
    };

    if (!body?.serviceType || !body.startAt || !body.endAt || typeof body.capacity !== 'number') {
      return NextResponse.json({ error: 'Dati slot incompleti.' }, { status: 400 });
    }

    const slot = await upsertAdminSlot({
      slotId: body.slotId ?? null,
      serviceType: body.serviceType,
      serviceVariant: body.serviceVariant ?? null,
      startAt: body.startAt,
      endAt: body.endAt,
      capacity: body.capacity,
      isActive: body.isActive ?? true,
      notes: body.notes ?? null,
    });

    return NextResponse.json(slot);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
