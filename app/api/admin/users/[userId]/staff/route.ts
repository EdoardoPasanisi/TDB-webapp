import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { setAdminUserStaffRole } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import type { StaffRole } from '@/lib/admin/types';

export async function PUT(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess('manage');

    const { userId } = await context.params;
    const body = (await request.json().catch(() => null)) as { role?: StaffRole | null } | null;

    if (!body || !('role' in body)) {
      return NextResponse.json({ error: 'Ruolo non valido.' }, { status: 400 });
    }

    const role = await setAdminUserStaffRole({ userId, role: body.role ?? null });
    return NextResponse.json({ role });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
