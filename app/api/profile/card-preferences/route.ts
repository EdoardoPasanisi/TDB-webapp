import { NextResponse } from 'next/server';

import { sanitizeProfileCardPreferencesPatch } from '@/lib/admin/validation';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const PROFILE_CARD_OWNER_SELECT = `
  user_id,
  first_name, last_name, phone, email,
  address_line, city, zip_code, province,
  dog_address_line, dog_city, dog_zip_code, dog_province,
  show_first_name_on_dog_card,
  show_last_name_on_dog_card,
  show_phone_on_dog_card,
  show_email_on_dog_card,
  show_address_on_dog_card,
  show_dog_address_on_dog_card
`;

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const patch = sanitizeProfileCardPreferencesPatch(await request.json().catch(() => null));

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({ ...patch, user_id: userId }, { onConflict: 'user_id' })
      .select(PROFILE_CARD_OWNER_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error, 'Impossibile aggiornare le preferenze del profilo.') },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per aggiornare la scheda pubblica.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
