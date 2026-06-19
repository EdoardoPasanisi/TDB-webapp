// FILE: components/services/booking/BookingDogsList.tsx
'use client';

import type { BookingDogExtras, BookingDogRow } from '@/types/booking';
import { accommodationLabel, euro } from '@/lib/services/formatters';

function extrasToLines(extras: BookingDogExtras | null | undefined): string[] {
  const lines: string[] = [];
  if (!extras) return lines;

  if (extras.grooming) lines.push('Toelettatura');
  if (extras.vaccine) lines.push('Vaccino');

  if (typeof extras.trackingSessions === 'number' && extras.trackingSessions > 0) {
    lines.push(`Ricerca olfattiva: ${extras.trackingSessions}`);
  }
  if (typeof extras.fitnessSessions === 'number' && extras.fitnessSessions > 0) {
    lines.push(`Fitness: ${extras.fitnessSessions}`);
  }
  if (typeof extras.walkSessions === 'number' && extras.walkSessions > 0) {
    lines.push(`Passeggiate: ${extras.walkSessions}`);
  }
  if (typeof extras.trekkingSessions === 'number' && extras.trekkingSessions > 0) {
    lines.push(`Trekking: ${extras.trekkingSessions}`);
  }

  return lines;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-panelInset p-3">
      <div className="ui-muted">{label}</div>
      <div className="ui-body font-[var(--font-weight-semibold)] mt-1 leading-tight">{value}</div>
    </div>
  );
}

export function BookingDogsList({
  dogs,
}: {
  dogs: Array<BookingDogRow & { dogName: string; dogBreed?: string | null }>;
}) {
  return (
    <section className="ui-card ui-cardContent space-y-3">
      <h2 className="ui-h2">Pet</h2>

      <div className="space-y-3">
        {dogs.map((d) => {
          const extrasLines = extrasToLines(d.extras);
          const therapyActive = Boolean(d.extras?.therapyActive);
          const therapyNotes = d.extras?.therapyNotes?.trim() ?? '';

          return (
            <article key={d.id} className="ui-panel p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="ui-minw0">
                  <p className="ui-body font-[var(--font-weight-semibold)] break-words">{d.dogName}</p>
                  {d.dogBreed ? (
                    <div className="mt-1 ui-muted">
                      Razza: <span className="ui-body">{d.dogBreed}</span>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 ui-accentBox px-3 py-2 text-right">
                  <p className="ui-muted">Totale pet</p>
                  <p className="ui-body font-[var(--font-weight-semibold)]">{euro(d.per_dog_total)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <InfoTile label="Alloggio" value={accommodationLabel(d.accommodation_type)} />
                </div>
                <InfoTile label="Tariffa al giorno" value={euro(d.accommodation_price_per_day)} />
                <InfoTile label="Giorni" value={String(d.days_count)} />
                <InfoTile label="Totale alloggio" value={euro(d.accommodation_subtotal)} />
                <InfoTile label="Totale extra" value={euro(d.extras_subtotal)} />
              </div>

              {extrasLines.length > 0 ? (
                <div className="mt-3 ui-panelInset p-3">
                  <p className="ui-body font-[var(--font-weight-semibold)]">Extra selezionati</p>
                  <ul className="mt-2 list-disc pl-5 space-y-1 ui-body">
                    {extrasLines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-3 ui-panelInset p-3 ui-muted">
                  Nessun extra selezionato
                </div>
              )}

              {therapyActive || therapyNotes ? (
                <div className="mt-3 ui-panelInset p-3">
                  <p className="ui-body font-[var(--font-weight-semibold)]">Terapia</p>
                  <div className="mt-2 space-y-1">
                    {therapyActive ? <p className="ui-body">Terapia attiva</p> : null}
                    {therapyNotes ? (
                      <p className="ui-muted">
                        Note: <span className="ui-body">{therapyNotes}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
