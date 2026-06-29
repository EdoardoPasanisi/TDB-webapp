'use client';

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { AdminAnalytics } from '@/lib/admin/types';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  EmptyCard,
  ErrorCard,
  LoadingCard,
  MetricCard,
  formatEuro,
  type LoadState,
} from '@/components/admin/shared';

export function AnalyticsTab() {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);

  const load = async () => {
    setState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<AdminAnalytics>('/api/admin/analytics');
      setAnalytics(data);
      setState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i dati di analisi.'));
      setState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchAdminJson<AdminAnalytics>('/api/admin/analytics', { signal: controller.signal })
      .then((data) => {
        setAnalytics(data);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i dati di analisi.'));
        setState('error');
      });

    return () => {
      controller.abort();
    };
  }, []);

  if (state === 'loading' || state === 'idle') return <LoadingCard label="Caricamento analisi..." />;
  if (state === 'error' || !analytics) return <ErrorCard error={error ?? 'Errore analisi.'} onRetry={load} />;

  return (
    <div className="admin-blocks space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Utenti totali" value={analytics.totals.users} />
        <MetricCard label="Utenti attivi" value={analytics.totals.activeUsers} />
        <MetricCard label="Cani registrati" value={analytics.totals.dogs} />
        <MetricCard label="Cani attivi" value={analytics.totals.activeDogs} />
        <MetricCard label="Fatturato confermato" value={formatEuro(analytics.totals.confirmedRevenue)} />
        <MetricCard label="Prenotazioni confermate" value={analytics.totals.confirmedBookings} />
        <MetricCard label="Ultimi 30 giorni" value={formatEuro(analytics.totals.last30DaysRevenue)} />
        <MetricCard label="Prenotazioni 30 giorni" value={analytics.totals.last30DaysBookings} />
      </div>

      <Card>
        <CardContent className="space-y-3">
          <SectionHeader
            title="Fatturato per servizio"
            subtitle="Valori aggregati sulle prenotazioni confermate, pagate o completate."
          />
          {analytics.revenueByService.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {analytics.revenueByService.map((entry) => (
                <Card key={entry.serviceKey} className="admin-listCard">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="ui-body font-[var(--font-weight-semibold)]">{entry.label}</div>
                        <div className="ui-muted">{entry.bookings} prenotazioni contabilizzate</div>
                      </div>
                      <div className="ui-accentPill">{formatEuro(entry.revenue)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyCard label="Nessun dato disponibile per l'analisi." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
