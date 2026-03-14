// FILE: components/services/calendar/SlotMonthPicker.tsx
'use client';

import { useMemo } from 'react';
import type { ServiceSlotRow } from '@/types/services';
import { Card, CardContent } from '@/components/ui/Card';

type Props = {
  monthDate: Date;
  slots: ServiceSlotRow[];
  selectedDayKey: string | null; // YYYY-MM-DD
  onSelectDay: (dayKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function SlotMonthPicker({
  monthDate,
  slots,
  selectedDayKey,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const { year, monthIndex } = useMemo(() => {
    return { year: monthDate.getFullYear(), monthIndex: monthDate.getMonth() };
  }, [monthDate]);

  const monthLabel = useMemo(() => {
    return monthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }, [monthDate]);

  const firstOfMonth = useMemo(() => new Date(year, monthIndex, 1), [year, monthIndex]);
  const daysInMonth = useMemo(() => new Date(year, monthIndex + 1, 0).getDate(), [year, monthIndex]);

  const offset = useMemo(() => {
    const jsDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
    return (jsDay + 6) % 7; // 0=Mon..6=Sun
  }, [firstOfMonth]);

  const availableDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) set.add(toDayKey(new Date(s.start_at)));
    return set;
  }, [slots]);

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

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="ui-body font-[var(--font-weight-semibold)]">Disponibilità</div>
            <div className="ui-fine capitalize">{monthLabel}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevMonth}
              aria-label="Mese precedente"
              className="ui-btn ui-clickableDay h-[52px] w-[56px] px-0"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              aria-label="Mese successivo"
              className="ui-btn ui-clickableDay h-[52px] w-[56px] px-0"
            >
              →
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2 ui-fine font-medium">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => (
            <div key={d} className="text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((c, idx) => {
            const isAvailable = c.key ? availableDayKeys.has(c.key) : false;
            const isSelected = c.key && selectedDayKey === c.key;

            const base =
              'min-h-[44px] px-2 py-2 text-left transition ui-fine ui-clickableDay ui-clickableDayCell';
            const empty = 'border-transparent bg-transparent';
            const disabled = 'opacity-40 cursor-not-allowed';
            const selected = 'ui-clickableDay--selected';

            return (
              <button
                key={idx}
                type="button"
                disabled={!c.key || !isAvailable}
                onClick={() => c.key && onSelectDay(c.key)}
                className={[
                  base,
                  !c.key ? empty : '',
                  !c.key || !isAvailable ? disabled : '',
                  isSelected ? selected : '',
                ].join(' ')}
              >
                <div className="font-semibold">{c.day ?? ''}</div>
                {isAvailable && <div className="mt-1 ui-fine opacity-80">slot</div>}
              </button>
            );
          })}
        </div>

        <div className="mt-3 ui-fine">
          Seleziona un giorno evidenziato per vedere gli slot disponibili.
        </div>
      </CardContent>
    </Card>
  );
}

function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
