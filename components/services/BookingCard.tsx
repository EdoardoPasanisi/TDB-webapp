// FILE: components/services/BookingCard.tsx
'use client';

import { useRouter } from 'next/navigation';
import type { UnifiedBookingListItem } from '@/types/booking';
import { euro, formatDate, serviceLabel, statusLabel, taxiLabel } from '@/lib/services/formatters';
import { getServiceLabel } from '@/types/services';
import { Card, CardContent } from '@/components/ui/Card';

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  const dateRange =
    booking.kind === 'PENSIONE'
      ? booking.end_date
        ? `${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}`
        : formatDate(booking.start_date)
      : `${formatDateTime(booking.start_at)}${booking.end_at ? ` → ${formatDateTime(booking.end_at)}` : ''}`;

  const dogNames = booking.dogNames ?? [];

  const dogsLine =
    dogNames.length > 0
      ? dogNames.join(', ')
      : booking.kind === 'PENSIONE' && booking.dogs_count
      ? `${booking.dogs_count} cane/i`
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
              <div className="ui-muted mt-1">{dateRange}</div>
            </div>

            <div className="text-right shrink-0">
              <div className="ui-muted">{statusLabel(booking.status)}</div>
              {price ? <div className="ui-body font-[var(--font-weight-semibold)] mt-1">{price}</div> : null}
            </div>
          </div>

          <div className="space-y-1">
            <div className="ui-muted">
              <span className="text-[var(--text)] font-[var(--font-weight-semibold)]">Cani:</span> {dogsLine}
            </div>

            {booking.kind === 'PENSIONE' && booking.extrasSummary && booking.extrasSummary !== 'Nessun extra' ? (
              <div className="ui-muted">
                <span className="text-[var(--text)] font-[var(--font-weight-semibold)]">Extra:</span>{' '}
                {booking.extrasSummary}
              </div>
            ) : null}

            {taxi && taxi !== 'No taxi dog' ? (
              <div className="ui-muted">
                <span className="text-[var(--text)] font-[var(--font-weight-semibold)]">Taxi:</span> {taxi}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end">
            <span className="ui-muted" aria-hidden="true">
              ›
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
