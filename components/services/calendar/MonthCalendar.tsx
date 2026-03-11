// FILE: components/services/calendar/MonthCalendar.tsx
'use client';

import { useMemo } from 'react';

export type CalendarBookingItem = {
  id: string;
  startAtIso: string; // ISO timestamptz
  endAtIso: string; // ISO timestamptz
  label: string;
  colorClass: string; // tenuto per compatibilità, non usato nelle celle
  showTime?: boolean;
};

type Props = {
  monthDate: Date;
  items: Array<CalendarBookingItem & { dayKey?: string }>;
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDayKeyFromIso(iso: string): string {
  return (iso ?? '').slice(0, 10); // robusto (no timezone shift)
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function iterateDaysInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start.getTime());
  const endTime = end.getTime();

  while (cur.getTime() <= endTime) {
    out.push(new Date(cur.getTime()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function MonthCalendar({ monthDate, items, selectedDayKey, onSelectDay, onPrevMonth, onNextMonth }: Props) {
  const { year, monthIndex } = useMemo(() => ({ year: monthDate.getFullYear(), monthIndex: monthDate.getMonth() }), [monthDate]);

  const monthLabel = useMemo(() => {
    return monthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }, [monthDate]);

  const firstOfMonth = useMemo(() => new Date(year, monthIndex, 1), [year, monthIndex]);
  const daysInMonth = useMemo(() => new Date(year, monthIndex + 1, 0).getDate(), [year, monthIndex]);

  // Monday-first offset
  const offset = useMemo(() => {
    const jsDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
    return (jsDay + 6) % 7; // 0=Mon..6=Sun
  }, [firstOfMonth]);

  const dayHasEvents = useMemo(() => {
    const set = new Set<string>();

    for (const it of items) {
      // dayKey “precalcolato” (se presente) altrimenti derivato dallo start
      const startKey = it.dayKey ? String(it.dayKey) : toDayKeyFromIso(it.startAtIso);

      // Se non abbiamo end, o non è valida, marcatura single-day
      const startDate = it.startAtIso ? stripTime(new Date(it.startAtIso)) : null;
      const endDate = it.endAtIso ? stripTime(new Date(it.endAtIso)) : null;

      if (!startDate || Number.isNaN(startDate.getTime())) {
        if (startKey) set.add(startKey);
        continue;
      }

      // Se endDate manca/invalid -> solo start
      if (!endDate || Number.isNaN(endDate.getTime())) {
        set.add(toDayKey(startDate));
        continue;
      }

      // Multi-day: marca tutti i giorni INCLUSI start e end
      for (const day of iterateDaysInclusive(startDate, endDate)) {
        set.add(toDayKey(day));
      }
    }

    return set;
  }, [items]);

  const cells = useMemo(() => {
    const out: Array<{ day: number | null; key: string | null }> = [];
    for (let i = 0; i < offset; i++) out.push({ day: null, key: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, monthIndex, day);
      out.push({ day, key: toDayKey(d) });
    }
    while (out.length % 7 !== 0) out.push({ day: null, key: null });
    return out;
  }, [offset, daysInMonth, year, monthIndex]);

  const weekLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <section className="ui-card ui-cardContent">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="ui-h2">Calendario</div>
          <div className="ui-muted mt-1 capitalize">{monthLabel}</div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevMonth} className="ui-selectCard ui-minw0" style={{ width: 56, textAlign: 'center' }}>
            ←
          </button>
          <button type="button" onClick={onNextMonth} className="ui-selectCard ui-minw0" style={{ width: 56, textAlign: 'center' }}>
            →
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 ui-muted" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
        {weekLabels.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Griglia giorni: armoniosa e mobile-first */}
      <div className="mt-3 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          const k = c.key;
          const isEmpty = !k;
          const hasEvents = k ? dayHasEvents.has(k) : false;
          const isSelected = k && selectedDayKey === k;

          return (
            <button
              key={`${k ?? 'empty'}_${idx}`}
              type="button"
              disabled={isEmpty}
              onClick={() => (k ? onSelectDay(k) : null)}
              className={[
                'ui-minw0',
                'rounded-[var(--radius)] border',
                'h-[52px] w-full',
                'flex items-center justify-center',
                isEmpty ? 'border-transparent bg-transparent' : 'bg-[var(--surface)]',
                hasEvents ? 'border-[rgba(255,130,0,0.55)] bg-[rgba(255,130,0,0.08)]' : 'border-[var(--border)]',
                isSelected ? 'ring-2 ring-[rgba(255,130,0,0.35)]' : '',
              ].join(' ')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex flex-col items-center justify-center leading-none">
                <div className={['ui-body', 'font-[var(--font-weight-bold)]', hasEvents ? 'text-[var(--text)]' : 'text-[var(--text)]'].join(' ')}>
                  {c.day ?? ''}
                </div>

                {/* piccolo indicatore “evento presente” senza deformare */}
                {!isEmpty ? (
                  <div
                    className="mt-1"
                    style={{
                      height: 4,
                      width: 18,
                      borderRadius: 999,
                      background: hasEvents ? 'var(--brand-accent)' : 'transparent',
                      opacity: hasEvents ? 0.95 : 0,
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
