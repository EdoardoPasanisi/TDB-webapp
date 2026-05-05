import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';

export default async function PaymentsCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id: bookingId } = await searchParams;
  const normalizedBookingId = String(bookingId ?? '').trim();

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
        <Card className="w-full">
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="ui-accentPill w-fit">Pagamento annullato</div>
              <h1 className="ui-title">Nessun addebito effettuato</h1>
              <p className="ui-muted">
                La prenotazione non è stata pagata. Puoi riprovare in qualsiasi momento.
              </p>
            </div>

            <div className="grid gap-2">
              {normalizedBookingId ? (
                <Link href={`/services/booking/${normalizedBookingId}`} className="ui-btn ui-btnTone-primary w-full">
                  Riapri prenotazione
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
