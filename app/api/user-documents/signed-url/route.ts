import { NextResponse } from 'next/server';

import { USER_DOCUMENT_BUCKET } from '@/lib/account/documentServer';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 60 * 10;

// Firma un documento dell'utente lato server (service role). La preview lato
// client non può usare storage.createSignedUrl direttamente perché dipende da
// policy RLS sul bucket privato che potrebbero non essere attive: qui usiamo
// supabaseAdmin, verificando che il path appartenga all'utente autenticato.
export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
    const path = String(body?.path ?? '').trim();

    if (!path || !path.startsWith(`${userId}/`)) {
      return NextResponse.json({ error: 'Percorso documento non valido.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(USER_DOCUMENT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error, 'Documento non trovato.') },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, url: data.signedUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per vedere il documento.') },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a caricare il documento.') },
      { status: 400 }
    );
  }
}
