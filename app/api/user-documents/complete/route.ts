import { NextResponse } from 'next/server';

import {
  finalizeUserDocuments,
  isUserDocumentKind,
  type DocumentSide,
  type FinalizeDocumentSide,
} from '@/lib/account/documentServer';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSide(value: unknown): DocumentSide | null {
  const side = String(value ?? '').trim().toUpperCase();
  return side === 'FRONT' || side === 'BACK' ? side : null;
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as {
      kind?: unknown;
      sides?: unknown;
    } | null;

    const kind = String(body?.kind ?? '').trim().toUpperCase();
    if (!isUserDocumentKind(kind)) {
      return NextResponse.json({ error: 'Tipo documento non valido.' }, { status: 400 });
    }

    const rawSides = Array.isArray(body?.sides) ? body!.sides : [];
    const sides: FinalizeDocumentSide[] = [];
    const userPrefix = `${userId}/`;

    for (const raw of rawSides) {
      const item = raw as { side?: unknown; path?: unknown };
      const path = String(item?.path ?? '').trim();
      // Difesa: un utente non può registrare file fuori dalla propria cartella.
      if (!path || !path.startsWith(userPrefix)) {
        return NextResponse.json({ error: 'Percorso documento non valido.' }, { status: 400 });
      }
      sides.push({ side: normalizeSide(item?.side), path });
    }

    if (!sides.length) {
      return NextResponse.json({ error: 'File mancante.' }, { status: 400 });
    }

    const result = await finalizeUserDocuments({ userId, kind, sides });

    return NextResponse.json(
      {
        ok: true,
        kind,
        frontPath: result.frontPath,
        backPath: result.backPath,
        profile: result.profile,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per caricare un documento.') },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a registrare il documento.') },
      { status: 400 }
    );
  }
}
