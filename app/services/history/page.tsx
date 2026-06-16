'use client';

import { useMemo } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useFutureBookings } from '@/lib/services/hooks/useFutureBookings';
import { BookingCard } from '@/components/services/BookingCard';
import type { UnifiedBookingListItem } from '@/types/booking';

function bookingYear(b: UnifiedBookingListItem): number {
  const raw = b.kind === 'PENSIONE' ? b.start_date : b.start_at;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getFullYear();
}

function bookingTime(b: UnifiedBookingListItem): number {
  const raw = b.kind === 'PENSIONE' ? b.start_date : b.start_at;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export default function BookingHistoryPage() {
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const { loading, error, bookings } = useFutureBookings(user?.id, { mode: 'history' });

  const groups = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => bookingTime(b) - bookingTime(a));
    const byYear = new Map<number, UnifiedBookingListItem[]>();
    for (const b of sorted) {
      const y = bookingYear(b);
      const list = byYear.get(y);
      if (list) list.push(b);
      else byYear.set(y, [b]);
    }
    return Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]);
  }, [bookings]);

  if (authLoading) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento…</p>
      </main>
    );
  }

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-6 space-y-5">
        <header className="space-y-1">
          <h1 className="ui-title">Storico prenotazioni</h1>
          <p className="ui-muted">Tutte le prenotazioni che hai effettuato.</p>
        </header>

        {loading ? <div className="ui-muted">Caricamento…</div> : null}
        {!loading && error ? <div className="ui-error">{error}</div> : null}
        {!loading && !error && bookings.length === 0 ? (
          <div className="ui-muted">Non hai ancora effettuato prenotazioni.</div>
        ) : null}

        {!loading && !error
          ? groups.map(([year, items]) => (
              <section key={year} className="space-y-3">
                <h2 className="ui-h2">{year}</h2>
                <div className="space-y-3">
                  {items.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              </section>
            ))
          : null}
      </div>
    </main>
  );
}
