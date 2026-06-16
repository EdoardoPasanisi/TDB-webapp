import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { assignAdminServicePass } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeAssignPassInput } from '@/lib/admin/validation';

// Assegna un pacchetto/credito al cliente (prezzo nel saldo, eventuale LOCKED).
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');
    const { productId } = sanitizeAssignPassInput(await request.json().catch(() => null));

    const pass = await assignAdminServicePass({ userId: normalizedUserId, productId });
    return NextResponse.json(pass);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
