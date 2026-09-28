import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { deleteAdminTestPayments } from '@/lib/admin/wallet';

// Elimina tutti i pagamenti di prova (tag C) con i loro movimenti. Resta un log.
export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess(request, 'manage');
    return NextResponse.json(await deleteAdminTestPayments(access.userId));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
