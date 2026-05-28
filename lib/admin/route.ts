import { NextResponse } from 'next/server';
import { AdminAccessError } from '@/lib/admin/auth';
import { humanizeErrorMessage } from '@/lib/errors/humanize';

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAccessError) {
    const response = NextResponse.json(
      { error: humanizeErrorMessage(error.message, 'Accesso al gestionale non disponibile.') },
      { status: error.status }
    );
    if (error.status === 429 && error.retryAfterMs != null) {
      response.headers.set('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
    }
    return response;
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: humanizeErrorMessage(error.message, 'Non siamo riusciti a completare l’operazione nel gestionale.') },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: 'Errore interno del gestionale.' }, { status: 500 });
}
