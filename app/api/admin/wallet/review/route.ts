import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { listAdminWalletReview, reviewAdminWalletOpening } from '@/lib/admin/wallet';

// Saldi da verificare: differenze emerse al passaggio al registro movimenti.
export async function GET() {
  try {
    await requireStaffAccess('manage');
    return NextResponse.json({ items: await listAdminWalletReview() });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

// { entryId, applyCorrection }: true = annulla la differenza, false = conferma il saldo attuale.
export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess(request, 'manage');
    const body = (await request.json().catch(() => null)) as { entryId?: unknown; applyCorrection?: unknown } | null;
    await reviewAdminWalletOpening({
      entryId: assertUuid(body?.entryId, 'Differenza'),
      applyCorrection: body?.applyCorrection === true,
      staffUserId: access.userId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
