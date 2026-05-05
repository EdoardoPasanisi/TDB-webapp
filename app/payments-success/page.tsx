import Link from 'next/link';
import { confirmStripeCheckoutSession } from '@/lib/server/payments';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Card, CardContent } from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function PaymentsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const normalizedSessionId = String(sessionId ?? '').trim();

  let errorMessage: string | null = null;
  let bookingId: string | null = null;
  let infoMessage = 'Pagamento confermato correttamente.';

  if (!normalizedSessionId) {
    errorMessage = 'Sessione di pagamento mancante.';
  } else {
    try {
      const result = await confirmStripeCheckoutSession(normalizedSessionId);
      bookingId = result.bookingId;
      infoMessage = result.message;
    } catch (error) {
      errorMessage = humanizeErrorMessage(
        error,
        'Non siamo riusciti a confermare il pagamento. Lo controlleremo manualmente.'
      );
    }
  }

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
        <Card className="w-full">
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="ui-accentPill w-fit">
                {errorMessage ? 'Pagamento da verificare' : 'Pagamento riuscito'}
              </div>
              <h1 className="ui-title">
                {errorMessage ? 'Controllo manuale richiesto' : 'Prenotazione aggiornata'}
              </h1>
              <p className="ui-muted">{errorMessage ?? infoMessage}</p>
            </div>

            <div className="grid gap-2">
              {bookingId ? (
                <Link href={`/services/booking/${bookingId}`} className="ui-btn ui-btnTone-primary w-full">
                  Apri prenotazione
                </Link>
              ) : null}

              <Link href="/services" className="ui-btn ui-btnTone-secondary w-full">
                Torna ai servizi
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
