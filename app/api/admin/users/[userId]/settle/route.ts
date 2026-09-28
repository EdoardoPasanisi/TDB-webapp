import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { settleAdminUserWallet } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { parsePaymentTag } from '@/lib/admin/payments';

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const access = await requireStaffAccess(request, 'manage');
    const { userId } = await context.params;

    const body = (await request.json().catch(() => null)) as { amountEur?: unknown; tag?: unknown } | null;
    const amountEur = Number(body?.amountEur);

    if (!Number.isFinite(amountEur) || amountEur < 0) {
      return NextResponse.json({ error: 'Importo non valido.' }, { status: 400 });
    }

    let tag;
    try {
      tag = parsePaymentTag(body?.tag);
    } catch (tagError) {
      return NextResponse.json({ error: (tagError as Error).message }, { status: 400 });
    }

    const result = await settleAdminUserWallet({
      userId: assertUuid(userId, 'Utente'),
      amountEur,
      staffUserId: access.userId,
      tag,
    });

    return NextResponse.json(result);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
