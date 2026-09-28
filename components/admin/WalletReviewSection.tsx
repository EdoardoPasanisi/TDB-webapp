'use client';

// Saldi da verificare: al passaggio al registro movimenti ogni saldo è stato
// confrontato con "servizi confermati − pagamenti registrati". Dove non tornava, la
// differenza è stata messa da parte in una riga "da verificare" (nessun saldo è
// cambiato). Qui lo staff decide, cliente per cliente, se correggerla o tenerla.

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { AdminWalletReviewItem } from '@/lib/admin/wallet';
import { EmptyCard, ErrorCard, LoadingCard, formatEuro, type LoadState } from '@/components/admin/shared';
import { useConfirm } from '@/components/admin/ConfirmProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function WalletReviewSection() {
  const confirm = useConfirm();
  const [state, setState] = useState<LoadState>('loading');
  const [items, setItems] = useState<AdminWalletReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fetchAdminJson<{ items: AdminWalletReviewItem[] }>('/api/admin/wallet/review');
      setItems(data.items);
      setState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i saldi da verificare.'));
      setState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminJson<{ items: AdminWalletReviewItem[] }>('/api/admin/wallet/review', { signal: controller.signal })
      .then((data) => {
        setItems(data.items);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i saldi da verificare.'));
        setState('error');
      });
    return () => controller.abort();
  }, []);

  const resolve = async (item: AdminWalletReviewItem, applyCorrection: boolean) => {
    const correctedBalance = item.currentBalanceEur - item.amountEur;
    const ok = await confirm({
      keyword: 'MODIFICA',
      title: applyCorrection ? `Correggi il saldo di ${item.customerName}` : `Conferma il saldo di ${item.customerName}`,
      message: applyCorrection
        ? `Il saldo passa da ${formatEuro(item.currentBalanceEur)} a ${formatEuro(correctedBalance)} (servizi confermati meno pagamenti registrati).`
        : `Il saldo resta ${formatEuro(item.currentBalanceEur)}: la differenza di ${formatEuro(item.amountEur)} viene considerata corretta.`,
    });
    if (!ok) return;
    setBusyId(item.entryId);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/wallet/review', {
        method: 'POST',
        body: JSON.stringify({ entryId: item.entryId, applyCorrection }),
      });
      await load();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare la verifica.'));
    } finally {
      setBusyId(null);
    }
  };

  if (state === 'loading' || state === 'idle') return <LoadingCard label="Caricamento saldi da verificare..." />;
  if (state === 'error') return <ErrorCard error={error ?? 'Errore.'} onRetry={() => void load()} />;

  return (
    <Card>
      <CardContent className="space-y-3">
        <SectionHeader
          title="Saldi da verificare"
          subtitle="Clienti il cui saldo non corrispondeva a “servizi confermati − pagamenti registrati” quando è stato attivato il registro movimenti. Controlla i movimenti nella scheda cliente, poi correggi o conferma."
        />
        {error ? <div className="ui-error">{error}</div> : null}
        {items.length === 0 ? (
          <EmptyCard label="Nessun saldo da verificare." />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.entryId} className="ui-card space-y-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="ui-body font-[var(--font-weight-semibold)] truncate">{item.customerName}</div>
                    <div className="ui-muted">
                      Saldo attuale {formatEuro(item.currentBalanceEur)} · corretto sarebbe{' '}
                      {formatEuro(item.currentBalanceEur - item.amountEur)}
                    </div>
                  </div>
                  <span className="ui-accentPill shrink-0">
                    {item.amountEur > 0 ? '+' : ''}
                    {formatEuro(item.amountEur)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    className="ui-btnCompact"
                    disabled={busyId === item.entryId}
                    onClick={() => void resolve(item, true)}
                  >
                    Correggi
                  </Button>
                  <Button
                    variant="secondary"
                    className="ui-btnCompact"
                    disabled={busyId === item.entryId}
                    onClick={() => void resolve(item, false)}
                  >
                    Mantieni saldo attuale
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
