import { NextResponse } from 'next/server';

import { findBreedProfileForSpecies } from '@/data/petBreeds';
import { sanitizeDogInput } from '@/lib/admin/validation';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const DOG_SELECT =
  'id, owner_id, created_at, updated_at, species, species_other, libretto_name, name, breed, size_category, grooming_difficulty, sex, microchip, birth_date, notes, coat_color, temperament, photo_path, is_active, public_id, show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes, show_coat_color, show_temperament, weight_kg, origin_breeds, show_weight, show_origin_breeds' as const;

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const dogInput = sanitizeDogInput(await request.json().catch(() => null));
    const breedProfile = findBreedProfileForSpecies(dogInput.species, dogInput.breed);
    const normalizedDogInput = {
      ...dogInput,
      // Per "Altro" non c'è razza: si tiene la taglia eventualmente passata.
      size_category: dogInput.species === 'OTHER' ? dogInput.size_category : breedProfile?.size ?? null,
      grooming_difficulty: dogInput.species === 'OTHER' ? dogInput.grooming_difficulty : breedProfile?.washDifficulty ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from('dogs')
      .insert({
        owner_id: userId,
        ...normalizedDogInput,
      })
      .select(DOG_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error, 'Impossibile creare il cane.') },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per registrare un cane.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
