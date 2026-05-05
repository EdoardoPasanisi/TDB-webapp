import { NextResponse } from 'next/server';

import { assertUuid, sanitizeDogCardVisibilityPatch } from '@/lib/admin/validation';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const DOG_SELECT =
  'id, owner_id, created_at, updated_at, name, breed, size_category, grooming_difficulty, sex, microchip, birth_date, notes, coat_color, temperament, photo_path, is_active, public_id, show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes, show_coat_color, show_temperament' as const;

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ dogId: string }> }
) {
  try {
    const { userId } = await requireRequestUser(request);
    const { dogId } = await context.params;
    const normalizedDogId = assertUuid(dogId, 'Cane');
    const patch = sanitizeDogCardVisibilityPatch(await request.json().catch(() => null));

    const { data, error } = await supabaseAdmin
      .from('dogs')
      .update(patch)
      .eq('id', normalizedDogId)
      .eq('owner_id', userId)
      .eq('is_active', true)
      .select(DOG_SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: humanizeErrorMessage(error, 'Non siamo riusciti ad aggiornare la visibilità della scheda cane.') }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Cane non trovato.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per modificare la scheda pubblica del cane.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
