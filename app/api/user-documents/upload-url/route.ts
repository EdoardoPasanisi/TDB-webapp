import { NextResponse } from 'next/server';

import { createUserDocumentUpload, isUserDocumentKind } from '@/lib/account/documentServer';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as {
      kind?: unknown;
      mimeType?: unknown;
      size?: unknown;
    } | null;

    const kind = String(body?.kind ?? '').trim().toUpperCase();
    if (!isUserDocumentKind(kind)) {
      return NextResponse.json({ error: 'Tipo documento non valido.' }, { status: 400 });
    }

    const upload = await createUserDocumentUpload({
      userId,
      kind,
      mimeType: String(body?.mimeType ?? ''),
      size: Number(body?.size ?? 0),
    });

    return NextResponse.json({ ok: true, upload }, { status: 200 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per caricare un documento.') },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a preparare il caricamento.') },
      { status: 400 }
    );
  }
}
