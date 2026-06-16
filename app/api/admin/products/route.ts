import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { listAdminServiceProducts } from '@/lib/admin/management';
import { adminErrorResponse } from '@/lib/admin/route';

// Catalogo pacchetti/crediti acquistabili (per assegnazione da gestionale).
export async function GET() {
  try {
    await requireStaffAccess('view');
    const products = await listAdminServiceProducts();
    return NextResponse.json({ items: products });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
