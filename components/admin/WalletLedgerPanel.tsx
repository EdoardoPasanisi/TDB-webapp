'use client';

// Storico movimenti del saldo di un cliente + rettifica manuale + annullamento di un
// pagamento registrato per errore. Il saldo è la somma dei movimenti; gli addebiti
// seguono i servizi in automatico (trigger del database).

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { AdminWalletEntry } from '@/lib/admin/wallet';
import { EmptyCard, formatDateTime, formatEuro } from '@/components/admin/shared';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Field } from '@/components/ui/Field';

const KIND_LABELS: Record<AdminWalletEntry['kind'], string> = {
  CHARGE: 'Addebito',
  PAYMENT: 'Pagamento',
  DISCOUNT: 'Sconto',
  ADJUSTMENT: 'Rettifica',
  OPENING: 'Da verificare',
};

export function WalletLedgerPanel({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [entries, setEntries] = useState<AdminWalletEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetchAdminJson<{ items: AdminWalletEntry[] }>(`/api/admin/users/${userId}/wallet`, { signal: controller.signal })
      .then((data) => setEntries(data.items))
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i movimenti.'));
      });
    return () => controller.abort();
  }, [open, userId, reloadKey]);

  const saveAdjustment = async () => {
    const value = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Inserisci un importo maggiore di zero.');
      return;
    }
    if (!note.trim()) {
      setError('Scrivi il motivo della rettifica.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/users/${userId}/wallet`, {
        method: 'POST',
        body: JSON.stringify({ amountEur: direction === 'credit' ? -value : value, note: note.trim() }),
      });
      setAdjustOpen(false);
      setAmount('');
      setNote('');
      setReloadKey((key) => key + 1);
      onChanged();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare la rettifica.'));
    } finally {
      setSaving(false);
    }
  };

  const startVoid = (paymentId: string) => {
    setVoidingPaymentId(paymentId);
    setVoidReason('');
    setVoidError(null);
    setNotice(null);
  };

  const confirmVoid = async () => {
    if (!voidingPaymentId) return;
    if (!voidReason.trim()) {
      setVoidError("Scrivi il motivo dell'annullamento.");
      return;
    }
    setVoidSaving(true);
    setVoidError(null);
    try {
      const result = await fetchAdminJson<{ restoredBookings: number; restoredPasses: number; hadEffects: boolean }>(
        `/api/admin/payments/${voidingPaymentId}/void`,
        { method: 'POST', body: JSON.stringify({ reason: voidReason.trim() }) }
      );
      const restored = [
        result.restoredBookings ? `${result.restoredBookings} prenotazioni non più "Pagata"` : null,
        result.restoredPasses ? `${result.restoredPasses} pacchetti di nuovo da sbloccare` : null,
      ].filter(Boolean);
      setNotice(
        result.hadEffects
          ? `Pagamento annullato: il saldo è tornato al dovuto${restored.length ? `, ${restored.join(' e ')}` : ''}.`
          : 'Pagamento annullato: il saldo è tornato al dovuto. Il pagamento è precedente al 15/10/2026, quindi le prenotazioni segnate "Pagata" vanno ricontrollate a mano.'
      );
      setVoidingPaymentId(null);
      setReloadKey((key) => key + 1);
      onChanged();
    } catch (err) {
      setVoidError(humanizeErrorMessage(err, 'Non siamo riusciti ad annullare il pagamento.'));
    } finally {
      setVoidSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="ui-btnCompact" onClick={() => setOpen((value) => !value)}>
          {open ? 'Nascondi movimenti' : 'Movimenti del saldo'}
        </Button>
        {open ? (
          <Button variant="secondary" className="ui-btnCompact" onClick={() => setAdjustOpen((value) => !value)}>
            Rettifica saldo
          </Button>
        ) : null}
      </div>

      {notice ? <div className="ui-muted">{notice}</div> : null}

      {/* Col modulo di rettifica aperto l'errore compare sopra "Salva rettifica". */}
      {error && !(open && adjustOpen) ? <div className="ui-error">{error}</div> : null}

      {open && adjustOpen ? (
        <div className="ui-card space-y-3 p-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'credit', label: 'Togli dal saldo (accredito)' },
                { key: 'debit', label: 'Aggiungi al saldo (addebito)' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setDirection(option.key)}
                className={`rounded-full px-3 py-1.5 ui-body ui-clickable${direction === option.key ? ' ui-clickable--selected' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Field label="Importo (€)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="ui-control ui-input"
              />
            </Field>
            <Field label="Motivo (obbligatorio)">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="ui-control ui-input"
                placeholder="Es. errore di addebito del 12/09"
              />
            </Field>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="ui-btnCompact" onClick={() => setAdjustOpen(false)} disabled={saving}>
              Annulla
            </Button>
            <Button variant="primary" className="ui-btnCompact" onClick={() => void saveAdjustment()} disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva rettifica'}
            </Button>
          </div>
        </div>
      ) : null}

      {open ? (
        entries === null ? (
          <div className="ui-muted">Caricamento movimenti…</div>
        ) : entries.length === 0 ? (
          <EmptyCard label="Nessun movimento." />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const canVoid = entry.kind === 'PAYMENT' && entry.paymentId && !entry.paymentVoided;
              return (
                <li key={entry.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="ui-body">
                        <span className="ui-muted">{KIND_LABELS[entry.kind]} · </span>
                        {entry.label}
                        {entry.kind === 'PAYMENT' && entry.paymentVoided ? <span className="ui-muted"> (annullato)</span> : null}
                      </div>
                      <div className="ui-muted text-xs">
                        {formatDateTime(entry.createdAt)}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="ui-body font-[var(--font-weight-semibold)]">
                        {entry.amountEur > 0 ? '+' : ''}
                        {formatEuro(entry.amountEur)}
                      </span>
                      {canVoid && voidingPaymentId !== entry.paymentId ? (
                        <Button
                          variant="secondary"
                          className="ui-btnCompact"
                          onClick={() => startVoid(entry.paymentId as string)}
                          disabled={voidSaving}
                        >
                          Annulla
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {canVoid && voidingPaymentId === entry.paymentId ? (
                    <div className="ui-card space-y-3 p-3">
                      <div className="ui-muted">
                        Il pagamento resta registrato come annullato e non conta più negli incassi. Il saldo torna al
                        dovuto, e le prenotazioni segnate &quot;Pagata&quot; e i pacchetti sbloccati da questo pagamento
                        tornano com&apos;erano. Poi potrai registrare il pagamento corretto.
                      </div>
                      <Field label="Motivo (obbligatorio)">
                        <input
                          value={voidReason}
                          onChange={(e) => setVoidReason(e.target.value)}
                          className="ui-control ui-input"
                          placeholder="Es. importo sbagliato, cliente sbagliato"
                        />
                      </Field>
                      <FormError message={voidError} />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="ui-btnCompact"
                          onClick={() => setVoidingPaymentId(null)}
                          disabled={voidSaving}
                        >
                          Indietro
                        </Button>
                        <Button variant="primary" className="ui-btnCompact" onClick={() => void confirmVoid()} disabled={voidSaving}>
                          {voidSaving ? 'Annullamento…' : 'Annulla pagamento'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
