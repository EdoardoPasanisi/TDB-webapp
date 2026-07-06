import { NextResponse } from 'next/server';

import { purgeUserAccount } from '@/lib/account/deleteAccount';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';

/**
 * Eliminazione account in-app richiesta dall'utente autenticato (App Store
 * Guideline 5.1.1-v). Hard-delete immediato e totale: rimuove tutti i dati
 * personali e l'utente `auth.users`. Il client deve poi fare signOut.
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);

    await purgeUserAccount(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per eliminare l’account.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: humanizeErrorMessage(
          error,
          'Non siamo riusciti a eliminare l’account. Riprova tra poco.'
        ),
      },
      { status: 500 }
    );
  }
}
