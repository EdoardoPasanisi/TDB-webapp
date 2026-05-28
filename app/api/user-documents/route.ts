import { NextResponse } from 'next/server';

import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { createManageStaffNotifications } from '@/lib/admin/notifications';
import { formatPersonName } from '@/lib/admin/utils';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  MAX_USER_DOCUMENT_BYTES,
  USER_DOCUMENT_MIME_TYPES,
  validateUploadBytes,
  validateUploadFile,
} from '@/lib/validation/uploads';

export const runtime = 'nodejs';

const ID_DOC_BUCKET = 'identity-documents';
const PROFILE_SELECT =
  'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';

type UserDocumentKind = 'ID_DOCUMENT' | 'WAIVER_SIGNED';

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

function isUserDocumentKind(value: string): value is UserDocumentKind {
  return value === 'ID_DOCUMENT' || value === 'WAIVER_SIGNED';
}

function getFileExt(file: File): string {
  const originalName = file.name || 'file';
  const extMatch = originalName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (extMatch?.[1]) return extMatch[1];
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function buildDocumentPath(userId: string, kind: UserDocumentKind, file: File): string {
  const folder = kind === 'ID_DOCUMENT' ? 'id-documents' : 'waivers';
  const token = crypto.randomUUID();
  return `${userId}/${folder}/${token}.${getFileExt(file)}`;
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const formData = await request.formData();

    const kind = String(formData.get('kind') ?? '').trim().toUpperCase();
    const file = formData.get('file');

    if (!isUserDocumentKind(kind)) {
      return NextResponse.json({ error: 'Tipo documento non valido.' }, { status: 400 });
    }

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

    const path = buildDocumentPath(userId, kind, file);
    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const signatureError = validateUploadBytes(file, headerBytes);
    if (signatureError) {
      return NextResponse.json({ error: signatureError }, { status: 400 });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ID_DOC_BUCKET)
      .upload(path, fileBytes, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      });

    if (uploadError) {
      return NextResponse.json({ error: humanizeErrorMessage(uploadError, 'Non siamo riusciti a caricare il documento.') }, { status: 400 });
    }

    const { data: documentRow, error: documentError } = await supabaseAdmin
      .from('user_documents')
      .insert({
        user_id: userId,
        kind,
        path,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (documentError || !documentRow) {
      await supabaseAdmin.storage.from(ID_DOC_BUCKET).remove([path]).catch(() => undefined);
      return NextResponse.json(
        { error: humanizeErrorMessage(documentError, 'Impossibile registrare il documento.') },
        { status: 400 }
      );
    }

    if (kind === 'WAIVER_SIGNED') {
      try {
        const { data: ownerProfile } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', userId)
          .maybeSingle();

        const owner = (ownerProfile ?? null) as {
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
        } | null;

        await createManageStaffNotifications({
          type: 'DOCUMENT_ACTION_REQUIRED',
          title: 'Nuova liberatoria da verificare',
          body: `${formatPersonName(owner?.first_name ?? null, owner?.last_name ?? null, owner?.email ?? null)} ha caricato una liberatoria firmata.`,
          data: {
            href: '/admin?tab=overview',
            adminTab: 'overview',
            documentId: String(documentRow.id),
          },
        });
      } catch (notificationError) {
        console.error('Admin document notification failed:', notificationError);
      }

      return NextResponse.json({ ok: true, kind, path }, { status: 200 });
    }

    const nowIso = new Date().toISOString();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          id_document_path: path,
          id_document_uploaded_at: nowIso,
        },
        { onConflict: 'user_id' }
      )
      .select(PROFILE_SELECT)
      .single();

    if (profileError || !profile) {
      try {
        await supabaseAdmin.from('user_documents').delete().eq('id', documentRow.id);
      } catch (rollbackError) {
        console.error('Document record rollback failed:', rollbackError);
      }
      await supabaseAdmin.storage.from(ID_DOC_BUCKET).remove([path]).catch(() => undefined);
      return NextResponse.json(
        { error: humanizeErrorMessage(profileError, 'Impossibile aggiornare il profilo.') },
        { status: 400 }
      );
    }

    try {
      await createManageStaffNotifications({
        type: 'DOCUMENT_ACTION_REQUIRED',
        title: 'Nuovo documento da verificare',
        body: `${formatPersonName(profile.first_name ?? null, profile.last_name ?? null, profile.email ?? null)} ha caricato un documento di identità.`,
        data: {
          href: '/admin?tab=overview',
          adminTab: 'overview',
          documentId: String(documentRow.id),
        },
      });
    } catch (notificationError) {
      console.error('Admin document notification failed:', notificationError);
    }

    return NextResponse.json(
      {
        ok: true,
        kind,
        path,
        profile,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per caricare un documento.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
