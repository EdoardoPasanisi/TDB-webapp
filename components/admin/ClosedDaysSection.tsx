'use client';

// Giorni di chiusura pensione (Config): in questi giorni non si può portare né
// riprendere il cane, ma si può restare in pensione a cavallo. Di base sono chiusi
// tutti i festivi nazionali; qui lo staff può riaprirne uno o aggiungere altri giorni
// (patrono, vigilie…). Le modifiche valgono per il singolo giorno dell'anno scelto.

import { useCallback, useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { ClosedDayEntry } from '@/lib/services/pensione/holidays';
import { EmptyCard, ErrorCard, LoadingCard, cx, type LoadState } from '@/components/admin/shared';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';

const WEEKDAY = new Intl.DateTimeFormat('it-IT', { weekday: 'short', timeZone: 'UTC' });

function formatDay(value: string): string {
  const [year, month, day] = value.split('-');
  const weekday = WEEKDAY.format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  return `${weekday} ${day}/${month}`;
}

export function ClosedDaysSection({ canManage }: { canManage: boolean }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<ClosedDayEntry[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (targetYear: number, signal?: AbortSignal) => {
    setState('loading');
    try {
      const data = await fetchAdminJson<{ items: ClosedDayEntry[] }>(
        `/api/admin/pensione-closed-days?year=${targetYear}`,
        { signal }
      );
      setItems(data.items);
      setState('ready');
    } catch (err) {
      if (isAbortError(err)) return;
      setState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(year, controller.signal);
    return () => controller.abort();
  }, [load, year]);

  const mutate = async (date: string, request: { method: 'POST' | 'DELETE'; body: Record<string, unknown> }) => {
    setError(null);
    setBusyDate(date);
    try {
      await fetchAdminJson('/api/admin/pensione-closed-days', {
        method: request.method,
        body: JSON.stringify({ date, ...request.body }),
      });
      await load(year);
      return true;
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare il giorno di chiusura.'));
      return false;
    } finally {
      setBusyDate(null);
    }
  };

  // Festivo: chiuso di default → riaprirlo salva un'eccezione, richiuderlo la toglie.
  const toggleHoliday = (item: ClosedDayEntry) =>
    item.closed
      ? mutate(item.date, { method: 'POST', body: { closed: false } })
      : mutate(item.date, { method: 'DELETE', body: {} });

  const removeCustom = (item: ClosedDayEntry) => mutate(item.date, { method: 'DELETE', body: {} });

  const addDay = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      setError('Seleziona la data da chiudere.');
      return;
    }
    setAdding(true);
    const ok = await mutate(newDate, { method: 'POST', body: { closed: true, label: newLabel.trim() || null } });
    setAdding(false);
    if (ok) {
      const addedYear = Number(newDate.slice(0, 4));
      setNewDate('');
      setNewLabel('');
      if (addedYear !== year) setYear(addedYear);
    }
  };

  const holidays = items.filter((item) => item.source === 'HOLIDAY');
  const custom = items.filter((item) => item.source === 'CUSTOM');

  return (
    <Card>
      <CardContent className="space-y-3">
        <SectionHeader
          title="Giorni di chiusura pensione"
          subtitle="In questi giorni i clienti non possono portare né riprendere il cane (restare in pensione a cavallo è possibile). I festivi sono chiusi di default: puoi riaprirne uno o aggiungere altri giorni. Le prenotazioni create dal gestionale non sono soggette a questo controllo."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="ui-btnCompact" onClick={() => setYear((y) => y - 1)}>
            ←
          </Button>
          <span className="ui-body font-[var(--font-weight-semibold)]">{year}</span>
          <Button variant="secondary" className="ui-btnCompact" onClick={() => setYear((y) => y + 1)}>
            →
          </Button>
        </div>

        <FormError message={error} />

        {state === 'loading' ? (
          <LoadingCard label="Carico i giorni di chiusura..." />
        ) : state === 'error' ? (
          <ErrorCard error="Non siamo riusciti a caricare i giorni di chiusura." onRetry={() => void load(year)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="ui-body font-[var(--font-weight-semibold)]">Festivi</div>
              {holidays.map((item) => (
                <label
                  key={item.date}
                  className={cx('ui-selectCard flex w-full items-center justify-between gap-3', item.closed && 'ui-selectCard--selected')}
                >
                  <div className="min-w-0">
                    <div className="ui-body font-[var(--font-weight-semibold)]">{item.label}</div>
                    <div className="ui-muted">{formatDay(item.date)}</div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 ui-body">
                    <input
                      type="checkbox"
                      checked={item.closed}
                      disabled={!canManage || busyDate === item.date}
                      onChange={() => void toggleHoliday(item)}
                    />
                    {item.closed ? 'Chiuso' : 'Aperto'}
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <div className="ui-body font-[var(--font-weight-semibold)]">Altri giorni di chiusura</div>
              {custom.length === 0 ? (
                <EmptyCard label="Nessun giorno aggiunto per quest’anno." />
              ) : (
                custom.map((item) => (
                  <div key={item.date} className="ui-selectCard ui-selectCard--selected flex w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="ui-body font-[var(--font-weight-semibold)]">{item.label}</div>
                      <div className="ui-muted">{formatDay(item.date)}</div>
                    </div>
                    {canManage ? (
                      <Button
                        variant="secondary"
                        className="ui-btnCompact shrink-0"
                        disabled={busyDate === item.date}
                        onClick={() => void removeCustom(item)}
                      >
                        Rimuovi
                      </Button>
                    ) : null}
                  </div>
                ))
              )}

              {canManage ? (
                <Card className="admin-listCard">
                  <CardContent className="space-y-3">
                    <div className="ui-body font-[var(--font-weight-semibold)]">Aggiungi giorno di chiusura</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Data">
                        <input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="ui-control ui-input"
                        />
                      </Field>
                      <Field label="Motivo (visibile al cliente)">
                        <input
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          maxLength={80}
                          placeholder="Es. Vigilia di Natale"
                          className="ui-control ui-input"
                        />
                      </Field>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="primary" className="ui-btnCompact" disabled={adding} onClick={() => void addDay()}>
                        {adding ? 'Salvataggio…' : 'Aggiungi'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
