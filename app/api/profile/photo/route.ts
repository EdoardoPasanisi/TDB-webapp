import { NextResponse } from 'next/server';

import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  MAX_PROFILE_PHOTO_BYTES,
  PROFILE_PHOTO_MIME_TYPES,
  validateUploadBytes,
  validateUploadFile,
} from '@/lib/validation/uploads';

export const runtime = 'nodejs';

const PROFILE_PHOTO_BUCKET = 'profile-images';
const PROFILE_SELECT =
  'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';

type ProfilePhotoRow = {
  user_id: string;
  photo_path: string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

function guessExtFromMimeOrName(file: File): string {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  if (byType[file.type]) return byType[file.type];

  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = match?.[1] ?? '';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  return 'jpg';
}

async function getProfilePhotoRow(userId: string): Promise<ProfilePhotoRow | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id, photo_path')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a leggere il profilo.') },
      { status: 400 }
    );
  }

  return (data ?? { user_id: userId, photo_path: null }) as ProfilePhotoRow;
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File mancante.' }, { status: 400 });
    }

    const validationError = validateUploadFile({
      file,
      allowedMimeTypes: PROFILE_PHOTO_MIME_TYPES,
      maxBytes: MAX_PROFILE_PHOTO_BYTES,
      invalidTypeMessage: 'Formato non valido. Usa JPG, PNG o WebP.',
      tooLargeMessage: 'La foto è troppo grande. Limite massimo: 5MB.',
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const profileLookup = await getProfilePhotoRow(userId);
    if (profileLookup instanceof NextResponse) return profileLookup;

    const previousPath = profileLookup.photo_path;
    const ext = guessExtFromMimeOrName(file);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signatureError = validateUploadBytes(file, bytes);
    if (signatureError) {
      return NextResponse.json({ error: signatureError }, { status: 400 });
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(path, bytes, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '31536000',
      });

    if (uploadError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(uploadError, 'Non siamo riusciti a caricare la foto profilo.') },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          photo_path: path,
        },
        { onConflict: 'user_id' }
      )
      .select(PROFILE_SELECT)
      .single();

    if (profileError || !profile) {
      await supabaseAdmin.storage.from(PROFILE_PHOTO_BUCKET).remove([path]).catch(() => undefined);
      return NextResponse.json(
        { error: humanizeErrorMessage(profileError, 'Non siamo riusciti a salvare la foto profilo.') },
        { status: 400 }
      );
    }

    if (previousPath && previousPath !== path) {
      await supabaseAdmin.storage.from(PROFILE_PHOTO_BUCKET).remove([previousPath]).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, path, profile }, { status: 200 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per modificare la foto profilo.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const profileLookup = await getProfilePhotoRow(userId);
    if (profileLookup instanceof NextResponse) return profileLookup;

    const previousPath = profileLookup.photo_path;
    if (!previousPath) {
      return NextResponse.json({ ok: true, profile: null }, { status: 200 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ photo_path: null })
      .eq('user_id', userId)
      .select(PROFILE_SELECT)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: humanizeErrorMessage(profileError, 'Non siamo riusciti ad aggiornare il profilo.') },
        { status: 400 }
      );
    }

    await supabaseAdmin.storage.from(PROFILE_PHOTO_BUCKET).remove([previousPath]).catch(() => undefined);

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per modificare la foto profilo.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
