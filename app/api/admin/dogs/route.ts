import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { searchAdminDogs } from '@/lib/admin/data';
import { createAdminDog } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeDogInput, sanitizeSearchQuery } from '@/lib/admin/validation';

export async function GET(request: Request) {
  try {
    const access = await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const query = sanitizeSearchQuery(searchParams.get('q') ?? '');
    const dogs = await searchAdminDogs(query, 50, access.canManage ? 'full' : 'limited');

    return NextResponse.json({ items: dogs });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');

    const body = (await request.json().catch(() => null)) as { ownerId?: unknown } | null;
    const ownerId = assertUuid(body?.ownerId, 'Proprietario');
    const dog = await createAdminDog(ownerId, sanitizeDogInput(body));

    return NextResponse.json(dog);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
