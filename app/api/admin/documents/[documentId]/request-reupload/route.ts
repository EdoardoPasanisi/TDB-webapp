import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { requestAdminDocumentReupload } from '@/lib/admin/data';
import { createUserNotificationIfEnabled } from '@/lib/notifications/server';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';

// "Richiedi di nuovo": rimette il documento da rivedere e blocca la prenotazione
// (azzera il documento d'identità registrato), notificando il cliente.
export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { documentId } = await context.params;
    const normalizedDocumentId = assertUuid(documentId, 'Documento');
    const result = await requestAdminDocumentReupload(normalizedDocumentId);

    const subject = result.kind === 'WAIVER_SIGNED' ? 'liberatoria firmata' : 'documento di identità';
    await createUserNotificationIfEnabled({
      userId: result.userId,
      type: 'DOCUMENT_STATUS',
      title: 'Documento da ricaricare',
      body: `Per continuare devi caricare di nuovo il tuo ${subject}.`,
      data: { href: '/account', documentKind: result.kind, status: 'REJECTED' },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
