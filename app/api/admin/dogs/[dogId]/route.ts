import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminDogDetail, updateAdminDog } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import type { DogInput } from '@/types/dog';

export async function GET(
  _request: Request,
  context: { params: Promise<{ dogId: string }> }
) {
  try {
    await requireStaffAccess('view');

    const { dogId } = await context.params;
    const detail = await getAdminDogDetail(dogId);

    if (!detail) {
      return NextResponse.json({ error: 'Cane non trovato.' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ dogId: string }> }
) {
  try {
    await requireStaffAccess('manage');

    const { dogId } = await context.params;
    const body = (await request.json().catch(() => null)) as DogInput | null;

    if (!body) {
      return NextResponse.json({ error: 'Payload cane non valido.' }, { status: 400 });
    }

    const dog = await updateAdminDog(dogId, body);
    return NextResponse.json(dog);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
