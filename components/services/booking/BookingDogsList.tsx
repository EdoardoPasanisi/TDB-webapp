// FILE: components/services/booking/BookingDogsList.tsx
'use client';

import type { BookingDogExtras, BookingDogRow } from '@/types/booking';
import { euro } from '@/lib/services/formatters';

function extrasToLines(extras: BookingDogExtras | null | undefined): string[] {
  const lines: string[] = [];
  if (!extras) return lines;

  if (extras.grooming) lines.push('Toelettatura');
  if (extras.vaccine) lines.push('Vaccino');

  if (typeof extras.trackingSessions === 'number' && extras.trackingSessions > 0) {
    lines.push(`Tracking: ${extras.trackingSessions}`);
  }
  if (typeof extras.fitnessSessions === 'number' && extras.fitnessSessions > 0) {
    lines.push(`Fitness: ${extras.fitnessSessions}`);
  }
  if (typeof extras.walkSessions === 'number' && extras.walkSessions > 0) {
    lines.push(`Passeggiate: ${extras.walkSessions}`);
  }

  if (extras.therapyActive) lines.push('Terapia attiva');
  if (extras.therapyNotes) lines.push(`Note terapia: ${extras.therapyNotes}`);

  return lines;
}

export function BookingDogsList({
  dogs,
}: {
  dogs: Array<BookingDogRow & { dogName: string; dogBreed?: string | null }>;
}) {
  return (
    <section className="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 className="text-lg font-semibold">Cani</h2>

      <div className="space-y-3">
        {dogs.map((d) => {
          const extrasLines = extrasToLines(d.extras);

          return (
            <div key={d.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{d.dogName}</p>
                  {d.dogBreed && <p className="text-sm text-gray-600">{d.dogBreed}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Totale cane</p>
                  <p className="text-sm font-semibold">{euro(d.per_dog_total)}</p>
                </div>
              </div>

              {/* ✅ più leggibile: niente text-xs */}
              <div className="mt-2 text-sm text-gray-700 space-y-1">
                <p>
                  <span className="font-medium">Alloggio:</span> {String(d.accommodation_type)} —{' '}
                  {euro(d.accommodation_price_per_day)}/giorno × {d.days_count}
                </p>

                {d.extras_subtotal > 0 && (
                  <p>
                    <span className="font-medium">Extra:</span> {euro(d.extras_subtotal)}
                  </p>
                )}

                {extrasLines.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">Dettagli extra:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {extrasLines.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
