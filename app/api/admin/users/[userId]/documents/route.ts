import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { createAdminWaiverDocument } from '@/lib/admin/data';
import { adminErrorResponse } from '@/lib/admin/route';
import { assertUuid } from '@/lib/admin/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  MAX_USER_DOCUMENT_BYTES,
  USER_DOCUMENT_MIME_TYPES,
  validateUploadBytes,
  validateUploadFile,
} from '@/lib/validation/uploads';

export const runtime = 'nodejs';

const ID_DOC_BUCKET = 'identity-documents';

function getFileExt(file: File): string {
  const match = (file.name || 'file').toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match?.[1]) return match[1];
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

// Lo staff carica la liberatoria firmata di un cliente direttamente dal gestionale.
// Crea una nuova riga user_documents (WAIVER_SIGNED) marcata come ACCETTATA.
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { userId } = await context.params;
    const normalizedUserId = assertUuid(userId, 'Utente');

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File mancante.' }, { status: 400 });
    }

    const validationError = validateUploadFile({
      file,
      allowedMimeTypes: USER_DOCUMENT_MIME_TYPES,
      maxBytes: MAX_USER_DOCUMENT_BYTES,
      invalidTypeMessage: 'Formato non valido. Usa PDF, JPG, PNG o WebP.',
      tooLargeMessage: 'Il file è troppo grande. Limite massimo: 10MB.',
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const signatureError = validateUploadBytes(file, headerBytes);
    if (signatureError) {
      return NextResponse.json({ error: signatureError }, { status: 400 });
    }

    const path = `${normalizedUserId}/waivers/${crypto.randomUUID()}.${getFileExt(file)}`;
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ID_DOC_BUCKET)
      .upload(path, fileBytes, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      });
    if (uploadError) {
      return NextResponse.json({ error: 'Non siamo riusciti a caricare la liberatoria.' }, { status: 400 });
    }

    try {
      const { documentId } = await createAdminWaiverDocument({ userId: normalizedUserId, path });
      return NextResponse.json({ ok: true, documentId, path });
    } catch (error) {
      await supabaseAdmin.storage.from(ID_DOC_BUCKET).remove([path]).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}
