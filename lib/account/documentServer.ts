import { createManageStaffNotifications } from '@/lib/admin/notifications';
import { formatPersonName } from '@/lib/admin/utils';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  MAX_USER_DOCUMENT_BYTES,
  USER_DOCUMENT_MIME_TYPES,
  validateUploadBytes,
  validateUploadMetadata,
} from '@/lib/validation/uploads';

export const USER_DOCUMENT_BUCKET = 'identity-documents';

const PROFILE_SELECT =
  'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, id_document_back_path, id_document_back_uploaded_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';

export type UserDocumentKind = 'ID_DOCUMENT' | 'WAIVER_SIGNED';
export type DocumentSide = 'FRONT' | 'BACK';

export function isUserDocumentKind(value: string): value is UserDocumentKind {
  return value === 'ID_DOCUMENT' || value === 'WAIVER_SIGNED';
}

function extFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

function buildDocumentPath(userId: string, kind: UserDocumentKind, mimeType: string): string {
  const folder = kind === 'ID_DOCUMENT' ? 'id-documents' : 'waivers';
  const token = crypto.randomUUID();
  return `${userId}/${folder}/${token}.${extFromMimeType(mimeType)}`;
}

export type UserDocumentUploadTarget = {
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
};

// Prepara un upload diretto a Supabase Storage: il file NON passa dalla
// serverless (quindi niente limite ~4,5MB di Vercel). Validiamo qui i metadati
// (tipo/dimensione); la firma dei byte reali viene verificata in finalize.
export async function createUserDocumentUpload(args: {
  userId: string;
  kind: UserDocumentKind;
  mimeType: string;
  size: number;
}): Promise<UserDocumentUploadTarget> {
  const mimeType = String(args.mimeType ?? '').trim().toLowerCase();

  const validationError = validateUploadMetadata({
    size: args.size,
    mimeType,
    allowedMimeTypes: USER_DOCUMENT_MIME_TYPES,
    maxBytes: MAX_USER_DOCUMENT_BYTES,
    invalidTypeMessage: 'Formato non valido. Usa PDF, JPG, PNG o WebP.',
    tooLargeMessage: 'Il file è troppo grande. Limite massimo: 10MB.',
  });
  if (validationError) throw new Error(validationError);

  const path = buildDocumentPath(args.userId, args.kind, mimeType);
  const { data, error } = await supabaseAdmin.storage
    .from(USER_DOCUMENT_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });

  if (error || !data) {
    throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a preparare il caricamento del documento.'));
  }

  return {
    bucket: USER_DOCUMENT_BUCKET,
    path: data.path || path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

// Legge i primi byte di un oggetto già caricato per verificarne la firma.
async function readStorageHeaderBytes(path: string, length: number): Promise<Uint8Array> {
  const { data: signed, error } = await supabaseAdmin.storage
    .from(USER_DOCUMENT_BUCKET)
    .createSignedUrl(path, 60);

  if (error || !signed?.signedUrl) {
    throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a verificare il documento caricato.'));
  }

  const response = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${length - 1}` },
    cache: 'no-store',
  });

  if (!response.ok && response.status !== 206) {
    throw new Error('Non siamo riusciti a verificare il documento caricato.');
  }

  return new Uint8Array(await response.arrayBuffer());
}

function mimeTypeFromPath(path: string): string {
  const ext = path.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

export type FinalizeDocumentSide = {
  side: DocumentSide | null;
  path: string;
};

export type FinalizeUserDocumentsResult = {
  profile: Record<string, unknown> | null;
  frontPath: string | null;
  backPath: string | null;
  documentIds: string[];
};

// Verifica i file già caricati (firma byte), registra le righe user_documents,
// aggiorna il profilo e notifica lo staff. Rollback completo in caso di errore.
export async function finalizeUserDocuments(args: {
  userId: string;
  kind: UserDocumentKind;
  sides: FinalizeDocumentSide[];
}): Promise<FinalizeUserDocumentsResult> {
  const { userId, kind, sides } = args;

  if (!sides.length) {
    throw new Error('Nessun documento da registrare.');
  }

  const insertedDocIds: string[] = [];
  const uploadedPaths: string[] = sides.map((s) => s.path);

  const rollback = async () => {
    try {
      if (insertedDocIds.length) {
        await supabaseAdmin.from('user_documents').delete().in('id', insertedDocIds);
      }
    } catch (rollbackError) {
      console.error('Document record rollback failed:', rollbackError);
    }
    await supabaseAdmin.storage.from(USER_DOCUMENT_BUCKET).remove(uploadedPaths).catch(() => undefined);
  };

  let frontPath: string | null = null;
  let backPath: string | null = null;

  for (const { side, path } of sides) {
    const mimeType = mimeTypeFromPath(path);
    const headerBytes = await readStorageHeaderBytes(path, 16);
    const signatureError = validateUploadBytes({ type: mimeType }, headerBytes);
    if (signatureError) {
      await rollback();
      throw new Error(signatureError);
    }

    const { data: documentRow, error: documentError } = await supabaseAdmin
      .from('user_documents')
      .insert({ user_id: userId, kind, side, path, status: 'PENDING' })
      .select('id')
      .single();

    if (documentError || !documentRow) {
      await rollback();
      throw new Error(humanizeErrorMessage(documentError, 'Impossibile registrare il documento.'));
    }

    insertedDocIds.push(String(documentRow.id));
    if (side === 'FRONT') frontPath = path;
    else if (side === 'BACK') backPath = path;
  }

  if (kind === 'ID_DOCUMENT') {
    const nowIso = new Date().toISOString();
    const profilePatch: Record<string, string> = { user_id: userId };
    if (frontPath) {
      profilePatch.id_document_path = frontPath;
      profilePatch.id_document_uploaded_at = nowIso;
    }
    if (backPath) {
      profilePatch.id_document_back_path = backPath;
      profilePatch.id_document_back_uploaded_at = nowIso;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePatch, { onConflict: 'user_id' })
      .select(PROFILE_SELECT)
      .single();

    if (profileError || !profile) {
      await rollback();
      throw new Error(humanizeErrorMessage(profileError, 'Impossibile aggiornare il profilo.'));
    }

    await notifyStaff({
      kind,
      documentId: insertedDocIds[0] ?? '',
      firstName: (profile as Record<string, string | null>).first_name ?? null,
      lastName: (profile as Record<string, string | null>).last_name ?? null,
      email: (profile as Record<string, string | null>).email ?? null,
    });

    return { profile: profile as Record<string, unknown>, frontPath, backPath, documentIds: insertedDocIds };
  }

  // WAIVER_SIGNED
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

  await notifyStaff({
    kind,
    documentId: insertedDocIds[0] ?? '',
    firstName: owner?.first_name ?? null,
    lastName: owner?.last_name ?? null,
    email: owner?.email ?? null,
  });

  return { profile: null, frontPath, backPath, documentIds: insertedDocIds };
}

async function notifyStaff(args: {
  kind: UserDocumentKind;
  documentId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): Promise<void> {
  const name = formatPersonName(args.firstName, args.lastName, args.email);
  const isWaiver = args.kind === 'WAIVER_SIGNED';
  try {
    await createManageStaffNotifications({
      type: 'DOCUMENT_ACTION_REQUIRED',
      title: isWaiver ? 'Nuova liberatoria da verificare' : 'Nuovo documento da verificare',
      body: isWaiver
        ? `${name} ha caricato una liberatoria firmata.`
        : `${name} ha caricato un documento di identità.`,
      data: {
        href: '/admin?tab=overview',
        adminTab: 'overview',
        documentId: args.documentId,
      },
    });
  } catch (notificationError) {
    console.error('Admin document notification failed:', notificationError);
  }
}
