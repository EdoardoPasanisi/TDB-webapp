// components/services/booking/BookingTotals.tsx
'use client';

import type { BookingRow } from '@/types/booking';
import { euro } from '@/lib/services/formatters';

export function BookingTotals({ booking }: { booking: BookingRow }) {
  // Quando non c'è sconto (tipicamente 1 solo cane), evitare di mostrare righe
  // ridondanti tipo "Sconto" e "Alloggio (scontato)".
  const dogsCount = booking.dogs_count ?? 1;
  const discountPercent = booking.alloggio_discount_percent ?? 0;
  const hasDiscount = dogsCount > 1 && discountPercent > 0;

  const rows: Array<{ label: string; value: number | null | undefined }> = [
    // Se non c'è sconto, mostriamo una sola riga "Alloggio".
    ...(hasDiscount
      ? [
          { label: 'Alloggio (pieno)', value: booking.alloggio_total_full },
          { label: 'Sconto (%)', value: discountPercent },
          { label: 'Alloggio (scontato)', value: booking.alloggio_total_discounted },
        ]
      : [{ label: 'Alloggio', value: booking.alloggio_total_full }]),

    { label: 'Extra (totale)', value: booking.extras_total },
    { label: 'Totale', value: booking.total_price },
  ];

  return (
    <section className="ui-panel p-4 space-y-2">
      <h2 className="ui-h2">Riepilogo</h2>

      <div className="ui-body space-y-1">
        {rows.map((r) => {
          // non mostrare righe vuote
          if (r.value === null || r.value === undefined) return null;

          if (r.label === 'Sconto (%)') {
            return (
              <p key={r.label} className="flex items-center justify-between">
                <span className="ui-muted">{r.label}</span>
                <span className="font-medium">{r.value}%</span>
              </p>
            );
          }

          return (
            <p key={r.label} className="flex items-center justify-between">
              <span className="ui-muted">{r.label}</span>
              <span className={r.label === 'Totale' ? 'font-semibold' : 'font-medium'}>
                {euro(r.value as number)}
              </span>
            </p>
          );
        })}
      </div>
    </section>
  );
}
