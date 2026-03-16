import { NextResponse } from 'next/server';
import { AdminAccessError } from '@/lib/admin/auth';

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: 'Errore interno del gestionale.' }, { status: 500 });
}
