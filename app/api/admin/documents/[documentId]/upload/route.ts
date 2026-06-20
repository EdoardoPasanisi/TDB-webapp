import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { replaceAdminDocumentFile } from '@/lib/admin/data';
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

// "Modifica": lo staff carica un nuovo file per il documento dal gestionale.
export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    await requireStaffAccess(request, 'manage');

    const { documentId } = await context.params;
    const normalizedDocumentId = assertUuid(documentId, 'Documento');

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

    // Carichiamo nella cartella dell'utente proprietario del documento.
    const { data: doc } = await supabaseAdmin
      .from('user_documents')
      .select('user_id, kind')
      .eq('id', normalizedDocumentId)
      .maybeSingle();
    if (!doc) {
      return NextResponse.json({ error: 'Documento non trovato.' }, { status: 404 });
    }
    const folder = doc.kind === 'ID_DOCUMENT' ? 'id-documents' : 'waivers';
    const newPath = `${doc.user_id}/${folder}/${crypto.randomUUID()}.${getFileExt(file)}`;

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ID_DOC_BUCKET)
      .upload(newPath, fileBytes, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      });
    if (uploadError) {
      return NextResponse.json({ error: 'Non siamo riusciti a caricare il documento.' }, { status: 400 });
    }

    try {
      await replaceAdminDocumentFile({ documentId: normalizedDocumentId, newPath });
    } catch (error) {
      await supabaseAdmin.storage.from(ID_DOC_BUCKET).remove([newPath]).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
