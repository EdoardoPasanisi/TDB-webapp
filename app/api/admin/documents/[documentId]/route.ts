import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { updateAdminDocumentStatus } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    await requireStaffAccess('manage');

    const { documentId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | { status?: 'ACCEPTED' | 'REJECTED'; staffNote?: string | null }
      | null;

    if (!body?.status) {
      return NextResponse.json({ error: 'Status documento mancante.' }, { status: 400 });
    }

    await updateAdminDocumentStatus({
      documentId,
      status: body.status,
      staffNote: body.staffNote ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
