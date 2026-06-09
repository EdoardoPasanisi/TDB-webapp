import { NextResponse } from 'next/server';

import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

// Segna il tour onboarding come completato/saltato per l'utente corrente.
export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        { user_id: userId, tutorial_completed_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error, 'Impossibile salvare lo stato del tutorial.') },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
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
