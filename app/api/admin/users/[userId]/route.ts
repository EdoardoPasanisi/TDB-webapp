import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { getAdminUserDetail, updateAdminUserProfile } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import type { Profile } from '@/types/profile';

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess('view');

    const { userId } = await context.params;
    const detail = await getAdminUserDetail(userId);

    if (!detail) {
      return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess('manage');

    const { userId } = await context.params;
    const body = (await request.json().catch(() => null)) as Partial<Profile> | null;

    if (!body) {
      return NextResponse.json({ error: 'Payload non valido.' }, { status: 400 });
    }

    const profile = await updateAdminUserProfile(userId, body);
    return NextResponse.json(profile);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
