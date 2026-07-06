import { NextResponse } from 'next/server';

import { resolveDogBreedProfile } from '@/data/petBreeds';
import { assertUuid, sanitizeDogInput } from '@/lib/admin/validation';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const DOG_SELECT =
  'id, owner_id, created_at, updated_at, species, species_other, libretto_name, name, breed, size_category, grooming_difficulty, sex, microchip, birth_date, notes, coat_color, temperament, photo_path, is_active, public_id, show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes, show_coat_color, show_temperament, weight_kg, origin_breeds, show_weight, show_origin_breeds, info_locked, info_locked_at' as const;

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
      .select('id, species, breed, size_category, grooming_difficulty, libretto_name, microchip, birth_date, origin_breeds, info_locked')
      .eq('id', normalizedDogId)
      .eq('owner_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingDogError) {
      return NextResponse.json({ error: humanizeErrorMessage(existingDogError, 'Non siamo riusciti a recuperare il pet.') }, { status: 400 });
    }
    if (!existingDog) {
      return NextResponse.json({ error: 'Pet non trovato.' }, { status: 404 });
    }

    // Se lo staff ha verificato e bloccato il cane, l'utente non può più cambiare i campi
    // "da libretto": nome sul libretto, razza, microchip, data di nascita (e taglia/difficoltà
    // derivate). Forziamo i valori esistenti ignorando quelli in arrivo.
    const locked = Boolean(existingDog.info_locked);
    const breed = locked ? existingDog.breed ?? null : dogInput.breed;
    const originBreeds = locked ? (existingDog.origin_breeds as string[] | null) ?? null : dogInput.origin_breeds;
    const librettoName = locked ? existingDog.libretto_name ?? null : dogInput.libretto_name;
    const microchip = locked ? existingDog.microchip ?? null : dogInput.microchip;
    const birthDate = locked ? existingDog.birth_date ?? null : dogInput.birth_date;

    // Taglia/difficoltà derivate dalla razza effettiva (o dalle razze di provenienza per i
    // meticci); per un cane bloccato restano quelle già salvate.
    const breedProfile = resolveDogBreedProfile(dogInput.species, breed, originBreeds);
    const normalizedDogInput = {
      ...dogInput,
      breed,
      origin_breeds: originBreeds,
      libretto_name: librettoName,
      microchip,
      birth_date: birthDate,
      size_category: locked
        ? existingDog.size_category ?? null
        : dogInput.species === 'OTHER'
          ? dogInput.size_category
          : breedProfile?.size ?? null,
      grooming_difficulty: locked
        ? existingDog.grooming_difficulty ?? null
        : dogInput.species === 'OTHER'
          ? dogInput.grooming_difficulty
          : breedProfile?.washDifficulty ?? null,
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
