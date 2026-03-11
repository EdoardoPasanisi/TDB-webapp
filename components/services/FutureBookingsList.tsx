// FILE: components/services/FutureBookingsList.tsx
'use client';

import type { UnifiedBookingListItem } from '@/types/booking';
import { BookingCard } from '@/components/services/BookingCard';

export function FutureBookingsList({
  loading,
  error,
  bookings,
}: {
  loading: boolean;
  error: string | null;
  bookings: UnifiedBookingListItem[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="ui-h2">Prenotazioni</div>
      </div>

      {loading ? <div className="ui-muted">Caricamento…</div> : null}

      {!loading && error ? <div className="ui-error">{error}</div> : null}

      {!loading && !error && bookings.length === 0 ? (
        <div className="ui-muted">Nessuna prenotazione.</div>
      ) : null}

      {!loading && !error && bookings.length > 0 ? (
        <div className="space-y-3">
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      ) : null}
    </section>
  );
}