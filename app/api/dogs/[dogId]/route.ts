import { NextResponse } from 'next/server';

import { findDogBreed } from '@/data/dogBreeds';
import { assertUuid, sanitizeDogInput } from '@/lib/admin/validation';
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
    const dogInput = sanitizeDogInput(await request.json().catch(() => null));

    const { data: existingDog, error: existingDogError } = await supabaseAdmin
      .from('dogs')
      .select('id, breed, size_category, grooming_difficulty')
      .eq('id', normalizedDogId)
      .eq('owner_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingDogError) {
      return NextResponse.json({ error: humanizeErrorMessage(existingDogError, 'Non siamo riusciti a recuperare il cane.') }, { status: 400 });
    }
    if (!existingDog) {
      return NextResponse.json({ error: 'Cane non trovato.' }, { status: 404 });
    }

    const breedChanged = (existingDog.breed ?? '').trim() !== (dogInput.breed ?? '').trim();
    const breedProfile = breedChanged ? findDogBreed(dogInput.breed) : null;
    const normalizedDogInput = {
      ...dogInput,
      size_category: breedChanged ? breedProfile?.size ?? null : existingDog.size_category ?? null,
      grooming_difficulty: breedChanged
        ? breedProfile?.washDifficulty ?? null
        : existingDog.grooming_difficulty ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from('dogs')
      .update(normalizedDogInput)
      .eq('id', normalizedDogId)
      .eq('owner_id', userId)
      .eq('is_active', true)
      .select(DOG_SELECT)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: humanizeErrorMessage(error, 'Non siamo riusciti a salvare il cane.') }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Cane non trovato.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per modificare i dati del cane.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ dogId: string }> }
) {
  try {
    const { userId } = await requireRequestUser(_request);
    const { dogId } = await context.params;
    const normalizedDogId = assertUuid(dogId, 'Cane');

    const { data, error } = await supabaseAdmin
      .from('dogs')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedDogId)
      .eq('owner_id', userId)
      .eq('is_active', true)
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: humanizeErrorMessage(error, 'Non siamo riusciti a eliminare il cane.') }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Cane non trovato.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per eliminare il cane.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
