// FILE: app/services/calendar/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

import { MonthCalendar, type CalendarBookingItem } from '@/components/services/calendar/MonthCalendar';
import { FutureBookingsList } from '@/components/services/FutureBookingsList';
import { useFutureBookings } from '@/lib/services/hooks/useFutureBookings';

import {
  getUserServiceSlotBookingsInRange,
  type ServiceSlotBookingWithRelations,
} from '@/lib/services/serviceCalendarApi';
import { getPensioneBookingsForUserInRange } from '@/lib/services/bookingsApi';
import { getServiceLabel, type ServiceType, type ServiceVariant } from '@/types/services';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type PensioneCalendarRow = Awaited<ReturnType<typeof getPensioneBookingsForUserInRange>>[number];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}
function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDayKeyFromIso(iso: string): string {
  return (iso ?? '').slice(0, 10); // YYYY-MM-DD (robusto, niente timezone shift)
}

function colorForServiceType(serviceType: string): string {
  // usato solo per dare una “tag” coerente nell’elenco sotto
  if (serviceType === 'PENSIONE') return 'bg-green-600';
  if (serviceType === 'ADDESTRAMENTO') return 'bg-blue-600';
  if (serviceType === 'ASILO') return 'bg-yellow-500';
  if (serviceType === 'CONSULENZA') return 'bg-orange-600';
  return 'bg-gray-600';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

type SelectedItem = CalendarBookingItem & {
  uid: string; // sempre univoco (niente key duplicate)
  dayKey: string; // YYYY-MM-DD
  kind: 'SLOT' | 'PENSIONE';
};

function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function clampToDayKey(v: string): string {
  // accetta già YYYY-MM-DD, altrimenti tenta di derivarlo
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return dayKeyFromIso(v);
}

// confronto lessicografico OK su YYYY-MM-DD
function isDayKeyInRange(dayKey: string, startKey: string, endKey: string): boolean {
  return dayKey >= startKey && dayKey <= endKey;
}

export default function CalendarPage() {
  const router = useRouter();

  const { user, loading: authLoading, error: authError } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const { loading: futureLoading, error: futureError, bookings } = useFutureBookings(user?.id);

  const [monthDate, setMonthDate] = useState<Date>(() => new Date());

  const [calendarState, setCalendarState] = useState<LoadState>('idle');
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarItems, setCalendarItems] = useState<SelectedItem[]>([]);

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // Carica items del mese
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;

    let cancelled = false;

    async function run() {
      setCalendarState('loading');
      setCalendarError(null);

      try {
        const start = startOfMonth(monthDate);
        const end = startOfNextMonth(monthDate);

        const startIso = start.toISOString();
        const endIso = end.toISOString();

        // Pensione usa DATE range [startDate, endDateExclusive)
        const startDate = toDateOnly(start);
        const endDateExclusive = toDateOnly(end);

        const [slotRows, pensioneRows] = await Promise.all([
          getUserServiceSlotBookingsInRange({ userId, startIso, endIso }),
          getPensioneBookingsForUserInRange({ userId, startDate, endDateExclusive }),
        ]);

        if (cancelled) return;

        const slotItems: SelectedItem[] = slotRows.map((booking: ServiceSlotBookingWithRelations, idx: number) => {
          const slot = booking.service_slots;
          const startAtIso = slot?.start_at ?? '';
          const endAtIso = slot?.end_at ?? '';
          const serviceType: ServiceType = booking.service_type;
          const serviceVariant: ServiceVariant | null = booking.service_variant ?? slot?.service_variant ?? null;

          // ✅ id usato per aprire il riepilogo booking (logica invariata)
          const id = booking.slot_id || slot?.id || booking.id;

          const dayKey = toDayKeyFromIso(startAtIso);

          return {
            kind: 'SLOT',
            uid: `SLOT:${id}:${startAtIso}:${idx}`, // ✅ sempre univoco
            id,
            startAtIso,
            endAtIso,
            dayKey,
            label: getServiceLabel(serviceType, serviceVariant),
            colorClass: colorForServiceType(serviceType),
          };
        });

        const pensioneItems: SelectedItem[] = pensioneRows.map((booking: PensioneCalendarRow, idx: number) => {
          // Importante: usiamo YYYY-MM-DD (no timezone)
          const startAtIso = `${booking.start_date}T00:00:00`;
          const endAtIso = `${booking.end_date ?? booking.start_date}T00:00:00`;

          const dayKey = booking.start_date.slice(0, 10);

          return {
            kind: 'PENSIONE',
            uid: `PENSIONE:${booking.id}:${booking.start_date}:${idx}`, // ✅ univoco
            id: booking.id,
            startAtIso,
            endAtIso,
            dayKey,
            label: 'Pensione',
            colorClass: colorForServiceType('PENSIONE'),
            showTime: false,
          };
        });

        const merged = [...slotItems, ...pensioneItems];

        setCalendarItems(merged);
        setCalendarState('ready');

        // Se non c’è un giorno selezionato, seleziona “oggi” (solo se nel mese)
        setSelectedDayKey((current) => current ?? toDateOnly(new Date()));
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setCalendarError(getErrorMessage(error, 'Errore caricamento calendario.'));
        setCalendarState('error');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [monthDate, user?.id]);

  // Items del giorno selezionato
  const selectedItems = useMemo(() => {
    if (!selectedDayKey) return [];

    const key = selectedDayKey;

    const filteredItems = calendarItems.filter((item) => {
        // Se l’item ha un dayKey esplicito (slot), usiamolo come fast-path
        const startKey = item.dayKey ? String(item.dayKey) : clampToDayKey(item.startAtIso);

        // Pensione (multi-day): controlla range
        // NB: per pensione endAtIso è sempre valorizzato nel tuo mapping (page.tsx)
        const maybeEndKey = item.endAtIso ? clampToDayKey(item.endAtIso) : startKey;

        // Se start==end -> single day (slot)
        if (startKey === maybeEndKey) return key === startKey;

        // Multi-day -> range match
        return isDayKeyInRange(key, startKey, maybeEndKey);
      });

    // opzionale: ordina per orario/label
    const sortedItems = [...filteredItems].sort((a, b) => {
      const ta = new Date(a.startAtIso).getTime();
      const tb = new Date(b.startAtIso).getTime();
      if (ta !== tb) return ta - tb;
      return a.label.localeCompare(b.label);
    });

    return sortedItems;
  }, [calendarItems, selectedDayKey]);

  const anyError = authError?.message ?? futureError ?? calendarError;

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        {anyError ? <p className="text-sm text-red-600">{anyError}</p> : null}

        <MonthCalendar
          monthDate={monthDate}
          items={calendarItems}
          selectedDayKey={selectedDayKey}
          onSelectDay={(k) => setSelectedDayKey(k)}
          onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        />

        {calendarState === 'loading' ? <div className="mt-2 text-sm text-gray-600">Aggiornamento calendario…</div> : null}

        {/* Eventi del giorno selezionato */}
        <section className="ui-card ui-cardContent">
          <div className="ui-h2">Eventi del giorno</div>
          <div className="ui-muted mt-1">{selectedDayKey ?? '—'}</div>

          {selectedItems.length === 0 ? (
            <div className="ui-muted mt-3">Nessuna prenotazione in questo giorno.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {selectedItems.map((it) => (
                <button
                  key={it.uid}
                  type="button"
                  onClick={() => router.push(`/services/booking/${it.id}`)}
                  className="ui-selectCard"
                >
                  <div className="flex items-center justify-between gap-3 ui-minw0">
                    <div className="ui-minw0">
                      <div className="ui-body font-[var(--font-weight-bold)] truncate">{it.label}</div>
                      <div className="ui-muted mt-1 truncate">
                        {it.showTime === false ? 'Giornata' : formatTimeRange(it.startAtIso, it.endAtIso)}
                      </div>
                    </div>

                    <span className="ui-pill">Apri</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <FutureBookingsList loading={futureLoading} error={futureError} bookings={bookings} />
      </div>
    </main>
  );
}

function formatTimeRange(startIso: string, endIso?: string): string {
  const a = startIso ? formatTime(startIso) : '';
  const b = endIso ? formatTime(endIso) : '';
  if (a && b) return `${a} → ${b}`;
  return a || b || '';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
