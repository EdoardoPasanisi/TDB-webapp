import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminDogDetail, updateAdminDog } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeDogInput } from '@/lib/admin/validation';

export async function GET(
  _request: Request,
  context: { params: Promise<{ dogId: string }> }
) {
  try {
    const access = await requireStaffAccess('view');

    const { dogId } = await context.params;
    const normalizedDogId = assertUuid(dogId, 'Cane');
    const detail = await getAdminDogDetail(normalizedDogId, access.canManage ? 'full' : 'limited');

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
    await requireStaffAccess(request, 'manage');

    const { dogId } = await context.params;
    const normalizedDogId = assertUuid(dogId, 'Cane');
    const dog = await updateAdminDog(
      normalizedDogId,
      sanitizeDogInput(await request.json().catch(() => null))
    );
    return NextResponse.json(dog);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
