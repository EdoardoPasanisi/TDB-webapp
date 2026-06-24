import { NextResponse } from 'next/server';

import { sanitizeProfilePatch } from '@/lib/admin/validation';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const PROFILE_SELECT =
  'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, id_document_back_path, id_document_back_uploaded_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const profilePatch = sanitizeProfilePatch(await request.json().catch(() => null));

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({ ...profilePatch, user_id: userId }, { onConflict: 'user_id' })
      .select(PROFILE_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error, 'Impossibile aggiornare il profilo.') },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per aggiornare il profilo.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
