import { NextResponse } from 'next/server';
import { AdminAccessError } from '@/lib/admin/auth';
import { humanizeErrorMessage } from '@/lib/errors/humanize';

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAccessError) {
    return NextResponse.json({ error: humanizeErrorMessage(error.message, 'Accesso al gestionale non disponibile.') }, { status: error.status });
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: humanizeErrorMessage(error.message, 'Non siamo riusciti a completare l’operazione nel gestionale.') },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: 'Errore interno del gestionale.' }, { status: 500 });
}
