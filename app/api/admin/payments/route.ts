import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { listAdminPaymentsByTag } from '@/lib/admin/payments';
import { adminErrorResponse } from '@/lib/admin/route';

// Importi e nomi dei clienti: solo per chi gestisce (niente VIEWER).
export async function GET() {
  try {
    await requireStaffAccess('manage');
    return NextResponse.json(await listAdminPaymentsByTag());
  } catch (error) {
    return adminErrorResponse(error);
  }
}
