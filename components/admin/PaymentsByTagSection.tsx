'use client';

// Analisi ricavi per tag: i pagamenti registrati con "Segna come pagato" finiscono
// nella lista C o CC a seconda del pulsante scelto dall'operatore. I C sono i pagamenti
// di prova (simulazioni, preventivi, anticipi finti): si eliminano tutti insieme, e i
// saldi dei clienti tornano come se non fossero mai stati registrati.

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { AdminPaymentsByTag } from '@/lib/admin/types';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/admin/ConfirmProvider';
import { EmptyCard, ErrorCard, LoadingCard, formatDateTime, formatEuro, type LoadState } from '@/components/admin/shared';

export function PaymentsByTagSection() {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminPaymentsByTag | null>(null);

  const load = async () => {
    try {
      const payload = await fetchAdminJson<AdminPaymentsByTag>('/api/admin/payments');
      setData(payload);
      setState('ready');
    } catch (err) {
      if (isAbortError(err)) return;
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i pagamenti.'));
      setState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminJson<AdminPaymentsByTag>('/api/admin/payments', { signal: controller.signal })
      .then((payload) => {
        setData(payload);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i pagamenti.'));
        setState('error');
      });
    return () => controller.abort();
  }, []);

  const confirm = useConfirm();
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const deleteTestPayments = async (count: number, total: number) => {
    const ok = await confirm({
      keyword: 'ELIMINA',
      title: 'Elimina tutti i pagamenti C',
      message: `Verranno eliminati ${count} pagamenti C (${formatEuro(total)}) insieme ai loro movimenti: i saldi dei clienti tornano come prima di quei pagamenti. Non si può annullare.`,
    });
    if (!ok) return;
    setCleaning(true);
    setCleanupMessage(null);
    try {
      const result = await fetchAdminJson<{ count: number; totalEur: number }>('/api/admin/payments/test-cleanup', {
        method: 'POST',
      });
      setCleanupMessage(`Eliminati ${result.count} pagamenti C (${formatEuro(result.totalEur)}).`);
      await load();
    } catch (err) {
      setCleanupMessage(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare i pagamenti C.'));
    } finally {
      setCleaning(false);
    }
  };

  const retry = () => {
    setState('loading');
    setError(null);
    void load();
  };

  if (state === 'loading' || state === 'idle') return <LoadingCard label="Caricamento pagamenti..." />;
  if (state === 'error' || !data) {
    return <ErrorCard error={error ?? 'Errore pagamenti.'} onRetry={retry} />;
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <SectionHeader
          title="Incassi per tipo"
          subtitle="Pagamenti registrati con “Segna come pagato”, divisi tra C (prova) e CC."
        />
        {cleanupMessage ? <div className="ui-muted">{cleanupMessage}</div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {data.tags.map((group) => (
            <Card key={group.tag} className="admin-listCard">
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="ui-body font-[var(--font-weight-semibold)]">Lista {group.tag}</div>
                    <div className="ui-muted">
                      {group.count} pagamenti · ultimi 30 giorni {formatEuro(group.last30DaysEur)}
                    </div>
                  </div>
                  <div className="ui-accentPill">{formatEuro(group.totalEur)}</div>
                </div>
                {group.tag === 'C' && group.count > 0 ? (
                  <Button
                    variant="secondary"
                    className="ui-btnCompact"
                    disabled={cleaning}
                    onClick={() => void deleteTestPayments(group.count, group.totalEur)}
                  >
                    {cleaning ? 'Eliminazione…' : 'Elimina tutti i pagamenti C'}
                  </Button>
                ) : null}
                {group.items.length ? (
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                          <span className="ui-body">{item.customerName}</span>
                          <span className="ui-muted"> · {formatDateTime(item.paidAt)}</span>
                        </span>
                        <span className="ui-body shrink-0 font-[var(--font-weight-semibold)]">
                          {formatEuro(item.amountEur)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyCard label={`Nessun pagamento ${group.tag}.`} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {data.untagged.count ? (
          <div className="ui-muted">
            Senza tag (registrati prima di C/CC): {data.untagged.count} pagamenti, {formatEuro(data.untagged.totalEur)}.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
