'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Toast } from '@/components/common/Toast';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { purchasePassFromProduct } from '@/lib/services/servicePassesApi';
import type { ServiceProductRow } from '@/types/services';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export type GroupedPurchaseSection = {
  key: string;
  label: string;
  itemTitle: string;
  emptyMessage: string;
  products: ServiceProductRow[];
};

type GroupedServicePurchasePageProps = {
  title: string;
  description: ReactNode;
  postPurchaseMessage: ReactNode;
  loadSections: () => Promise<GroupedPurchaseSection[]>;
  loadErrorMessage: string;
};

type SelectedChoice = {
  sectionKey: string;
  sectionLabel: string;
  product: ServiceProductRow;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function GroupedServicePurchasePage({
  title,
  description,
  postPurchaseMessage,
  loadSections,
  loadErrorMessage,
}: GroupedServicePurchasePageProps) {
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<GroupedPurchaseSection[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseOk, setPurchaseOk] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const sortedSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        products: [...section.products].sort((a, b) => a.credits - b.credits),
      })),
    [sections]
  );

  const totalChoices = useMemo(
    () => sortedSections.reduce((sum, section) => sum + section.products.length, 0),
    [sortedSections]
  );

  const selectedChoice = useMemo<SelectedChoice | null>(() => {
    if (!selectedKey) return null;

    const splitIndex = selectedKey.indexOf(':');
    if (splitIndex === -1) return null;

    const sectionKey = selectedKey.slice(0, splitIndex);
    const productId = selectedKey.slice(splitIndex + 1);
    if (!sectionKey || !productId) return null;

    const section = sortedSections.find((entry) => entry.key === sectionKey);
    if (!section) return null;

    const product = section.products.find((entry) => entry.id === productId);
    if (!product) return null;

    return {
      sectionKey,
      sectionLabel: section.label,
      product,
    };
  }, [selectedKey, sortedSections]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState('loading');
      setError(null);

      try {
        const loadedSections = await loadSections();
        if (cancelled) return;

        const normalizedSections = loadedSections.map((section) => ({
          ...section,
          products: [...section.products].sort((a, b) => a.credits - b.credits),
        }));

        setSections(normalizedSections);

        const firstChoice = normalizedSections
          .flatMap((section) => section.products.map((product) => `${section.key}:${product.id}`))[0] ?? null;

        setSelectedKey(firstChoice);
        setState('ready');
      } catch (loadError) {
        if (cancelled) return;

        console.error(loadError);
        setError(getErrorMessage(loadError, loadErrorMessage));
        setState('error');
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadErrorMessage, loadSections]);

  function openConfirm() {
    setError(null);
    setPurchaseOk(false);

    if (!selectedChoice) {
      setError('Seleziona un pacchetto.');
      return;
    }

    setConfirmOpen(true);
  }

  async function confirmPurchase() {
    if (!user) {
      setError('Devi effettuare il login per acquistare.');
      setConfirmOpen(false);
      return;
    }

    if (!selectedChoice) {
      setError('Seleziona un pacchetto.');
      setConfirmOpen(false);
      return;
    }

    setPurchasing(true);
    setError(null);
    setPurchaseOk(false);

    try {
      await purchasePassFromProduct({ userId: user.id, product: selectedChoice.product });
      setPurchaseOk(true);
      setToastMsg('Acquisto riuscito ✅ Crediti aggiunti.');
      setConfirmOpen(false);
    } catch (purchaseError) {
      console.error(purchaseError);
      setError(getErrorMessage(purchaseError, 'Errore durante l’acquisto.'));
    } finally {
      setPurchasing(false);
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3">
        <Card>
          <CardContent className="text-sm text-[var(--muted)]">Verifica autenticazione…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {toastMsg ? <Toast message={toastMsg} onClose={() => setToastMsg(null)} kind="success" /> : null}

      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-[var(--text)]">{title}</h1>
        <p className="text-sm text-[var(--muted)]">{description}</p>
      </div>

      {state === 'loading' ? (
        <Card>
          <CardContent className="text-sm text-[var(--muted)]">Caricamento prodotti…</CardContent>
        </Card>
      ) : null}

      {state === 'error' ? (
        <div className="rounded-[var(--radius)] border border-[rgba(255,80,80,0.35)] bg-[rgba(255,0,0,0.08)] p-4 text-sm text-[var(--text)]">
          {error}
        </div>
      ) : null}

      {state === 'ready' ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeader title="Scegli pacchetto" subtitle={null} />

            {totalChoices === 0 ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
                Nessun prodotto disponibile.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedSections.map((section) => (
                  <div key={section.key} className="space-y-2">
                    <div className="text-xs font-semibold text-[var(--muted)]">{section.label}</div>
                    <div className="space-y-2">
                      {section.products.map((product) => {
                        const choiceKey = `${section.key}:${product.id}`;
                        const checked = choiceKey === selectedKey;

                        return (
                          <button
                            key={choiceKey}
                            type="button"
                            onClick={() => setSelectedKey(choiceKey)}
                            className={[
                              'w-full rounded-[var(--radius)] border px-3 py-3 text-left transition',
                              checked
                                ? 'border-[var(--brand-accent)] bg-[rgba(255,130,0,0.14)] ring-2 ring-[rgba(255,130,0,0.35)]'
                                : 'border-[var(--border)] bg-[var(--surface-2)] hover:opacity-95',
                            ].join(' ')}
                            aria-pressed={checked}
                          >
                            <div className="ui-minw0">
                              <div className="flex items-start justify-between gap-3 ui-minw0">
                                <div className="ui-minw0">
                                  <div className="ui-body font-[var(--font-weight-semibold)] ui-minw0">
                                    {section.itemTitle}
                                  </div>
                                  <div className="ui-muted mt-1">Ingressi: {product.credits}</div>
                                </div>

                                <div className="ui-body font-[var(--font-weight-semibold)] shrink-0">
                                  {Number(product.price_eur).toFixed(0)}€
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {section.products.length === 0 ? (
                        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
                          {section.emptyMessage}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="primary"
              fullWidth
              onClick={openConfirm}
              disabled={!selectedChoice || purchasing || totalChoices === 0}
            >
              {purchasing ? 'Acquisto in corso…' : 'Acquista'}
            </Button>

            {purchaseOk ? (
              <div className="rounded-[var(--radius)] border border-[rgba(80,255,160,0.25)] bg-[rgba(80,255,160,0.08)] p-3 text-sm text-[var(--text)]">
                {postPurchaseMessage}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[var(--radius)] border border-[rgba(255,80,80,0.35)] bg-[rgba(255,0,0,0.08)] p-3 text-sm text-[var(--text)]">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Modal
        open={confirmOpen}
        title="Conferma acquisto"
        onClose={() => {
          if (purchasing) return;
          setConfirmOpen(false);
        }}
      >
        {!selectedChoice ? (
          <div className="text-sm text-[var(--muted)]">Seleziona un pacchetto prima di procedere.</div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="text-sm">
                <div className="font-semibold text-[var(--text)]">{selectedChoice.sectionLabel}</div>
                <div className="mt-1 text-[var(--text)]">{selectedChoice.product.name}</div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  Crediti: <span className="font-semibold text-[var(--text)]">{selectedChoice.product.credits}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Prezzo:{' '}
                  <span className="font-semibold text-[var(--text)]">{Number(selectedChoice.product.price_eur).toFixed(0)}€</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={purchasing}>
                Annulla
              </Button>
              <Button variant="primary" onClick={confirmPurchase} disabled={purchasing}>
                {purchasing ? 'Acquisto…' : 'Conferma acquisto'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
