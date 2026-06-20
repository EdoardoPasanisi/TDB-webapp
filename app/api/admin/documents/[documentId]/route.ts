import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { deleteAdminDocument, updateAdminDocumentStatus } from '@/lib/admin/data';
import { createUserNotificationIfEnabled } from '@/lib/notifications/server';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid, sanitizeDocumentDecisionInput } from '@/lib/admin/validation';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { documentId } = await context.params;
    const normalizedDocumentId = assertUuid(documentId, 'Documento');
    const body = sanitizeDocumentDecisionInput(await request.json().catch(() => null));

    const updated = await updateAdminDocumentStatus({
      documentId: normalizedDocumentId,
      status: body.status,
      staffNote: body.staffNote ?? null,
    });

    if (updated.previousStatus !== updated.status) {
      const subject =
        updated.kind === 'WAIVER_SIGNED' ? 'liberatoria firmata' : 'documento di identità';
      const approved = updated.status === 'ACCEPTED';

      await createUserNotificationIfEnabled({
        userId: updated.userId,
        type: 'DOCUMENT_STATUS',
        title: approved ? 'Documento approvato' : 'Documento da rivedere',
        body: approved
          ? `Il tuo ${subject} è stato approvato.`
          : `Il tuo ${subject} richiede attenzione o un nuovo caricamento.`,
        data: {
          href: '/account',
          documentKind: updated.kind,
          status: updated.status,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

// Elimina definitivamente un documento del cliente.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { documentId } = await context.params;
    const normalizedDocumentId = assertUuid(documentId, 'Documento');
    await deleteAdminDocument(normalizedDocumentId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
