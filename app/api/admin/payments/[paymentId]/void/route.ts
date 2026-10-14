import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { voidAdminPayment } from '@/lib/admin/wallet';

// Annulla un pagamento registrato per errore (motivo obbligatorio). Il pagamento resta
// registrato come annullato; saldo, prenotazioni e pacchetti tornano com'erano.
export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  try {
    const access = await requireStaffAccess(request, 'manage');
    const paymentId = assertUuid((await context.params).paymentId, 'Pagamento');
    const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
    const reason = String(body?.reason ?? '').trim().slice(0, 300);
    if (!reason) {
      return NextResponse.json({ error: "Scrivi il motivo dell'annullamento." }, { status: 400 });
    }

    return NextResponse.json(await voidAdminPayment({ paymentId, reason, staffUserId: access.userId }));
  } catch (error) {
    return adminErrorResponse(error);
  }
}
