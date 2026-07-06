import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';

type PushPlatform = 'ios' | 'android';

function parseBody(body: unknown): { token: string; platform: PushPlatform } {
  const record = (body ?? {}) as Record<string, unknown>;
  const token = typeof record.token === 'string' ? record.token.trim() : '';
  const platform: PushPlatform = record.platform === 'android' ? 'android' : 'ios';
  return { token, platform };
}

/** Salva/aggiorna il device token push dell'utente autenticato. */
export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const { token, platform } = parseBody(await request.json().catch(() => null));

    if (!token) {
      return NextResponse.json({ error: 'Token push mancante.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('push_tokens').upsert(
      {
        token,
        user_id: userId,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per registrare le notifiche.') },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Registrazione notifiche non riuscita.') },
      { status: 500 }
    );
  }
}

/** Rimuove un token (o tutti i token dell'utente) — es. al logout. */
export async function DELETE(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const { token } = parseBody(await request.json().catch(() => null));

    let query = supabaseAdmin.from('push_tokens').delete().eq('user_id', userId);
    if (token) query = query.eq('token', token);

    const { error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Non autorizzato.') },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Rimozione token non riuscita.') },
      { status: 500 }
    );
  }
}
