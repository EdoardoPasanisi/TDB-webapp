// FILE: app/services/booking/[id]/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Modal } from '@/components/common/Modal';
import { supabase } from '@/lib/supabaseClient';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useBookingDetail } from '@/lib/services/hooks/useBookingDetail';
import { BookingDetailHeader } from '@/components/services/booking/BookingDetailHeader';
import { BookingDogsList } from '@/components/services/booking/BookingDogsList';
import { BookingTotals } from '@/components/services/booking/BookingTotals';
import { BookingActions } from '@/components/services/booking/BookingActions';
import { euro, serviceLabel, statusLabel, taxiLabel } from '@/lib/services/formatters';
import { getServiceLabel } from '@/types/services';
import type { TaxiOption } from '@/types/booking';
import { Button } from '@/components/ui/Button';

function formatDateOnlyVerbose(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '—';
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatIsoDateVerbose(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatIsoClock(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatIsoDayRangeVerbose(startIso: string, endIso: string | null | undefined): string {
  const start = formatIsoDateVerbose(startIso);
  if (!endIso) return start;
  const end = formatIsoDateVerbose(endIso);
  return start === end ? start : `${start} → ${end}`;
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 5);
}

function isWithin24Hours(startAtIso: string): boolean {
  const start = new Date(startAtIso).getTime();
  const now = Date.now();
  const diffMs = start - now;
  return diffMs <= 24 * 60 * 60 * 1000;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function taxiHumanFromOption(option: TaxiOption | null | undefined): string {
  const lbl = taxiLabel(option);
  if (!lbl) return '—';
  if (lbl === 'No taxi dog') return 'Nessun taxi dog';
  return lbl;
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();

  const bookingId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return undefined;
    const id = Array.isArray(raw) ? raw[0] : raw;
    return typeof id === 'string' && id.trim().length > 0 ? id : undefined;
  }, [params]);

  const { user, loading: authLoading, error: authError } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const { loading, error, detail } = useBookingDetail(user?.id, bookingId);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (authLoading || !bookingId || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  if (authError || error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow p-4 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold mb-2">Prenotazione non disponibile</h1>
          <p className="text-sm text-gray-700">{authError?.message ?? error ?? 'Prenotazione non trovata.'}</p>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Caricamento...</p>
      </main>
    );
  }

  // =========================
  // PENSIONE
  // =========================
  if (detail.kind === 'PENSIONE') {
    const b = detail.booking;
    const arrivalDate = formatDateOnlyVerbose(b.start_date);
    const departureDate = formatDateOnlyVerbose(b.end_date ?? b.start_date);

    const daysCount = (() => {
      if (!b.start_date) return null;
      const start = new Date(b.start_date).getTime();
      const end = new Date((b.end_date ?? b.start_date) as string).getTime();
      const diff = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
      return diff > 0 ? diff : null;
    })();

    const taxiLine = taxiHumanFromOption(b.taxi_option);
    const showTaxi = taxiLine !== '—' && taxiLine !== 'Nessun taxi dog';

    return (
      <main className="min-h-screen bg-gray-100 p-4 text-gray-900">
        <div className="max-w-3xl mx-auto space-y-4">
          <BookingDetailHeader title={serviceLabel(b.service_type)} />

          <section className="bg-white rounded-lg shadow p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-semibold text-gray-900">Riepilogo</div>

              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{statusLabel(b.status)}</div>
                {typeof b.total_price === 'number' && b.total_price > 0 && (
                  <div className="text-base font-semibold mt-1">{euro(b.total_price)}</div>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="ui-muted">Arrivo</div>
                <div className="ui-body font-[var(--font-weight-semibold)] leading-tight mt-1">{arrivalDate}</div>
                <div className="ui-muted mt-1">Ore {formatClock(b.arrival_time)}</div>
              </div>

              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="ui-muted">Partenza</div>
                <div className="ui-body font-[var(--font-weight-semibold)] leading-tight mt-1">{departureDate}</div>
                <div className="ui-muted mt-1">Ore {formatClock(b.departure_time)}</div>
              </div>
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="ui-muted">Durata soggiorno</div>
              <div className="ui-body font-[var(--font-weight-semibold)] mt-1">{daysCount ? `${daysCount} giorni` : '—'}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-3 border-t">
              {showTaxi && (
                <div>
                  <div className="text-sm font-medium text-gray-800">Taxi dog</div>
                  <div className="mt-1 text-sm text-gray-700">
                    {taxiLine}
                    {typeof b.taxi_price === 'number' && b.taxi_price > 0 ? ` • ${euro(b.taxi_price)}` : ''}
                  </div>
                </div>
              )}

              <div className={showTaxi ? '' : 'sm:col-span-2'}>
                <div className="text-sm font-medium text-gray-800">Note</div>
                <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{b.notes?.trim() ? b.notes : '—'}</div>
              </div>
            </div>
          </section>

          <BookingDogsList dogs={detail.bookingDogs} />
          <BookingTotals booking={detail.booking} />
          <BookingActions bookingId={detail.booking.id} />
        </div>
      </main>
    );
  }

  // =========================
  // SERVICE SLOT (ASILO / ADDESTRAMENTO / CONSULENZA)
  // =========================
  const sb = detail.slotBooking;
  const within24h = isWithin24Hours(sb.start_at);
  const showDogs = sb.service_type !== 'CONSULENZA';

  const serviceTitle = getServiceLabel(sb.service_type, sb.service_variant ?? null);

  const dogsLabel =
    sb.dogs.length === 0
      ? '—'
      : sb.dogs.length === 1
      ? sb.dogs[0].name
      : sb.dogs.map((d) => d.name).join(', ');

  const taxiLine = sb.taxi_enabled ? 'Taxi dog richiesto' : 'Nessun taxi dog';
  const taxiDetails =
    sb.taxi_enabled && (sb.taxi_price_eur || sb.taxi_distance_km)
      ? [
          typeof sb.taxi_distance_km === 'number' ? `${sb.taxi_distance_km} km` : null,
          typeof sb.taxi_price_eur === 'number' ? euro(sb.taxi_price_eur) : null,
        ]
          .filter(Boolean)
          .join(' • ')
      : '';

  const warnNoRefund = within24h
    ? '⚠️ Sei entro 24 ore dall’appuntamento: puoi annullare, ma NON verrà restituito il credito.'
    : 'Il credito ti verrà restituito.';

  const handleCancelServiceSlotGroup = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      for (const id of sb.booking_ids) {
        const { error: rpcError } = await supabase.rpc('cancel_service_slot_booking', {
          p_user_id: user.id,
          p_booking_id: id,
        });
        if (rpcError) {
          setActionError(rpcError.message);
          return;
        }
      }

      setConfirmOpen(false);
      router.push(`/services?refresh=${Date.now()}`);
    } catch (e) {
      setActionError(getErrorMessage(e, 'Errore durante la cancellazione.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-gray-900">
      <div className="max-w-3xl mx-auto space-y-4">
        <BookingDetailHeader title={serviceTitle} />

        <section className="bg-white rounded-lg shadow p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="text-base font-semibold text-gray-900">Riepilogo</div>

            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">{statusLabel(sb.status)}</div>
              {typeof sb.total_price === 'number' && sb.total_price > 0 && (
                <div className="text-base font-semibold mt-1">{euro(sb.total_price)}</div>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="ui-muted">Giorno</div>
              <div className="ui-body font-[var(--font-weight-semibold)] leading-tight mt-1">
                {formatIsoDayRangeVerbose(sb.start_at, sb.end_at)}
              </div>
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="ui-muted">Inizio</div>
              <div className="ui-body font-[var(--font-weight-semibold)] mt-1">Ore {formatIsoClock(sb.start_at)}</div>
            </div>

            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="ui-muted">Fine</div>
              <div className="ui-body font-[var(--font-weight-semibold)] mt-1">Ore {sb.end_at ? formatIsoClock(sb.end_at) : '—'}</div>
            </div>
          </div>

          <div className={showDogs ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2'}>
            {showDogs ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="ui-muted">Cani</div>
                <div className="ui-body font-[var(--font-weight-semibold)] mt-1">{dogsLabel}</div>
              </div>
            ) : null}
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="ui-muted">Crediti usati</div>
              <div className="ui-body font-[var(--font-weight-semibold)] mt-1">{sb.credits_spent}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-3 border-t">
            <div>
              <div className="text-sm font-medium text-gray-800">Taxi dog</div>
              <div className="mt-1 text-sm text-gray-700">
                {taxiLine}
                {taxiDetails ? ` • ${taxiDetails}` : ''}
              </div>
            </div>

            <div className="sm:col-span-1">
              <div className="text-sm font-medium text-gray-800">Note</div>
              <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{sb.notes?.trim() ? sb.notes : '—'}</div>
            </div>

            <div className="sm:col-span-2 pt-2">
              <Button type="button" variant="primary" fullWidth disabled={actionLoading} onClick={() => setConfirmOpen(true)}>
                {actionLoading ? 'Annullamento…' : 'Annulla prenotazione'}
              </Button>
            </div>
          </div>
        </section>

        <Modal
          open={confirmOpen}
          title="Annulla prenotazione"
          onClose={() => {
            if (actionLoading) return;
            setConfirmOpen(false);
            setActionError(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--text)]">
              {sb.dogs.length > 1
                ? `Vuoi annullare questa prenotazione per ${sb.dogs.length} cani?`
                : 'Vuoi annullare questa prenotazione?'}
            </p>
            <p className="text-sm text-[var(--muted)]">{warnNoRefund}</p>

            {actionError ? (
              <div className="rounded-[var(--radius)] border border-[rgba(255,80,80,0.35)] bg-[rgba(255,0,0,0.08)] p-3 text-sm text-[var(--text)]">
                {actionError}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={actionLoading}
                onClick={() => {
                  setConfirmOpen(false);
                  setActionError(null);
                }}
              >
                Mantieni prenotazione
              </Button>
              <Button type="button" variant="primary" disabled={actionLoading} onClick={handleCancelServiceSlotGroup}>
                {actionLoading ? 'Annullamento…' : 'Conferma annullamento'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}
