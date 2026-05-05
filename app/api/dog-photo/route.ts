import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import {
  DOG_PHOTO_MIME_TYPES,
  MAX_DOG_PHOTO_BYTES,
  validateUploadFile,
} from '@/lib/validation/uploads';

export const runtime = 'nodejs';

type DogRow = {
  id: string;
  owner_id: string;
  is_active: boolean | null;
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

async function getOwnedDogOrResponse(dogId: string, userId: string): Promise<DogRow | NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('dogs')
    .select('id, owner_id, is_active, photo_path')
    .eq('id', dogId)
    .maybeSingle();

  const dogRow = (data ?? null) as DogRow | null;

  if (error) {
    return NextResponse.json({ error: humanizeErrorMessage(error, 'Non siamo riusciti a recuperare i dati del cane.') }, { status: 400 });
  }
  if (!dogRow || dogRow.is_active === false) {
    return NextResponse.json({ error: 'Cane non trovato.' }, { status: 404 });
  }
  if (dogRow.owner_id !== userId) {
    return NextResponse.json({ error: 'Non hai i permessi per modificare questo cane.' }, { status: 403 });
  }

  return dogRow;
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireRequestUser(req);

    const form = await req.formData();
    const dogId = String(form.get('dogId') ?? '').trim();
    const file = form.get('file');

    if (!dogId) {
      return NextResponse.json({ error: 'Manca il riferimento del cane.' }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Seleziona una foto prima di continuare.' }, { status: 400 });
    }

    const validationError = validateUploadFile({
      file,
      allowedMimeTypes: DOG_PHOTO_MIME_TYPES,
      maxBytes: MAX_DOG_PHOTO_BYTES,
      invalidTypeMessage: 'Formato non valido. Usa JPG, PNG o WebP.',
      tooLargeMessage: 'La foto è troppo grande. Limite massimo: 5MB.',
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const dogLookup = await getOwnedDogOrResponse(dogId, userId);
    if (dogLookup instanceof NextResponse) return dogLookup;
    const dogRow = dogLookup;

    const ext = guessExtFromMimeOrName(file);
    const path = `${userId}/${dogId}.${ext}`;
    const previousPath = dogRow.photo_path;
    if (previousPath && previousPath !== path) {
      await supabaseAdmin.storage.from('dog-images').remove([previousPath]).catch(() => undefined);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage.from('dog-images').upload(path, bytes, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '31536000',
    });

    if (uploadError) {
      return NextResponse.json({ error: humanizeErrorMessage(uploadError, 'Non siamo riusciti a caricare la foto.') }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('dogs')
      .update({ photo_path: path, updated_at: new Date().toISOString() })
      .eq('id', dogId)
      .eq('owner_id', userId);

    if (updateError) {
      await supabaseAdmin.storage.from('dog-images').remove([path]).catch(() => undefined);
      return NextResponse.json({ error: humanizeErrorMessage(updateError, 'Non siamo riusciti a salvare la foto del cane.') }, { status: 400 });
    }

    return NextResponse.json({ ok: true, path }, { status: 200 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per modificare la foto del cane.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireRequestUser(req);

    const body = (await req.json().catch(() => null)) as null | { dogId?: string };
    const dogId = String(body?.dogId ?? '').trim();
    if (!dogId) {
      return NextResponse.json({ error: 'Manca il riferimento del cane.' }, { status: 400 });
    }

    const dogLookup = await getOwnedDogOrResponse(dogId, userId);
    if (dogLookup instanceof NextResponse) return dogLookup;
    const dogRow = dogLookup;

    if (dogRow.photo_path) {
      const { error: removeError } = await supabaseAdmin.storage
        .from('dog-images')
        .remove([dogRow.photo_path]);

      if (removeError) {
        return NextResponse.json({ error: humanizeErrorMessage(removeError, 'Non siamo riusciti a rimuovere la foto del cane.') }, { status: 400 });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('dogs')
      .update({ photo_path: null, updated_at: new Date().toISOString() })
      .eq('id', dogId)
      .eq('owner_id', userId);

    if (updateError) {
      return NextResponse.json({ error: humanizeErrorMessage(updateError, 'Non siamo riusciti ad aggiornare il profilo del cane.') }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per modificare la foto del cane.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
