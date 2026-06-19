// FILE: components/services/BookingCard.tsx
'use client';

import { useRouter } from 'next/navigation';
import type { UnifiedBookingListItem } from '@/types/booking';
import { euro, serviceLabel, statusLabel, taxiLabel } from '@/lib/services/formatters';
import { getServiceLabel } from '@/types/services';
import { Card, CardContent } from '@/components/ui/Card';
import { OpenDetailsHint } from '@/components/ui/OpenDetailsHint';

function formatIsoDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatIsoTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatIsoDayRange(startIso: string, endIso?: string): string {
  const start = formatIsoDate(startIso);
  if (!endIso) return start;
  const end = formatIsoDate(endIso);
  return start === end ? start : `${start} → ${end}`;
}

function formatDateKeyVerbose(yyyyMmDd: string | null | undefined): string {
  if (!yyyyMmDd) return '—';
  const date = new Date(`${yyyyMmDd}T00:00:00`);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 5);
}

function getBookingServiceTitle(booking: UnifiedBookingListItem): string {
  if (booking.kind !== 'SERVICE_SLOT') {
    return serviceLabel(booking.service_type);
  }

  switch (booking.service_type) {
    case 'PENSIONE':
    case 'ASILO':
    case 'ADDESTRAMENTO':
    case 'CONSULENZA':
      return getServiceLabel(booking.service_type, booking.service_variant ?? null);
    default:
      return serviceLabel(booking.service_type);
  }
}

export function BookingCard({ booking }: { booking: UnifiedBookingListItem }) {
  const router = useRouter();

  const serviceTitle = getBookingServiceTitle(booking);
  const showDogsLine = !(booking.kind === 'SERVICE_SLOT' && booking.service_type === 'CONSULENZA');

  const dogNames = booking.dogNames ?? [];

  const dogsLine =
    dogNames.length > 0
      ? dogNames.join(', ')
      : booking.kind === 'PENSIONE' && booking.dogs_count
      ? `${booking.dogs_count} pet`
      : '—';

  const price = euro(booking.total_price);

  const taxi =
    booking.kind === 'PENSIONE' ? taxiLabel(booking.taxi_option) : booking.taxi_enabled ? 'Taxi dog' : '';

  return (
    <button type="button" onClick={() => router.push(`/services/booking/${booking.id}`)} className="w-full text-left">
      <Card className="ui-selectCard">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="ui-body font-[var(--font-weight-semibold)] truncate">{serviceTitle}</div>
            </div>

            <div className="text-right shrink-0">
              <div className="ui-muted">{statusLabel(booking.status)}</div>
              {price ? <div className="ui-body font-[var(--font-weight-semibold)] mt-1">{price}</div> : null}
            </div>
          </div>

          {booking.kind === 'PENSIONE' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="ui-panelInset p-3">
                <div className="ui-muted">Arrivo</div>
                <div className="ui-body font-[var(--font-weight-semibold)] mt-1 whitespace-nowrap">
                  {formatDateKeyVerbose(booking.start_date)}
                </div>
                <div className="ui-muted mt-1 whitespace-nowrap">Ore {formatClock(booking.arrival_time)}</div>
              </div>

              <div className="ui-panelInset p-3">
                <div className="ui-muted">Partenza</div>
                <div className="ui-body font-[var(--font-weight-semibold)] mt-1 whitespace-nowrap">
                  {formatDateKeyVerbose(booking.end_date ?? booking.start_date)}
                </div>
                <div className="ui-muted mt-1 whitespace-nowrap">Ore {formatClock(booking.departure_time)}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 ui-panelInset p-3">
                <div className="ui-muted">Giorno</div>
                <div className="ui-body font-[var(--font-weight-semibold)] mt-1 whitespace-nowrap">
                  {formatIsoDayRange(booking.start_at, booking.end_at)}
                </div>
              </div>

              <div className="ui-panelInset p-3">
                <div className="ui-muted">Inizio</div>
                <div className="ui-body font-[var(--font-weight-semibold)] mt-1 whitespace-nowrap">Ore {formatIsoTime(booking.start_at)}</div>
              </div>

              <div className="ui-panelInset p-3">
                <div className="ui-muted">Fine</div>
                <div className="ui-body font-[var(--font-weight-semibold)] mt-1 whitespace-nowrap">Ore {booking.end_at ? formatIsoTime(booking.end_at) : '—'}</div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {showDogsLine ? (
              <div className="ui-muted">
                <span className="ui-body font-[var(--font-weight-semibold)]">Pet:</span> {dogsLine}
              </div>
            ) : null}

            {booking.kind === 'PENSIONE' && booking.extrasSummary && booking.extrasSummary !== 'Nessun extra' ? (
              <div className="ui-muted">
                <span className="ui-body font-[var(--font-weight-semibold)]">Extra:</span>{' '}
                {booking.extrasSummary}
              </div>
            ) : null}

            {taxi && taxi !== 'No taxi dog' ? (
              <div className="ui-muted">
                <span className="ui-body font-[var(--font-weight-semibold)]">Taxi:</span> {taxi}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end">
            <OpenDetailsHint />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
