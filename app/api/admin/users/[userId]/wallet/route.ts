import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { adjustAdminWallet, listAdminWalletEntries } from '@/lib/admin/wallet';

type Context = { params: Promise<{ userId: string }> };

// Storico movimenti del saldo di un cliente.
export async function GET(_request: Request, context: Context) {
  try {
    await requireStaffAccess('manage');
    const userId = assertUuid((await context.params).userId, 'Utente');
    return NextResponse.json({ items: await listAdminWalletEntries(userId) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

// Rettifica manuale: importo positivo = addebito, negativo = accredito. Motivo obbligatorio.
export async function POST(request: Request, context: Context) {
  try {
    const access = await requireStaffAccess(request, 'manage');
    const userId = assertUuid((await context.params).userId, 'Utente');
    const body = (await request.json().catch(() => null)) as { amountEur?: unknown; note?: unknown } | null;

    const amountEur = Math.round(Number(body?.amountEur) * 100) / 100;
    const note = String(body?.note ?? '').trim().slice(0, 300);
    if (!Number.isFinite(amountEur) || amountEur === 0) {
      return NextResponse.json({ error: 'Importo non valido.' }, { status: 400 });
    }
    if (!note) {
      return NextResponse.json({ error: 'Scrivi il motivo della rettifica.' }, { status: 400 });
    }

    await adjustAdminWallet({ userId, amountEur, note, staffUserId: access.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
