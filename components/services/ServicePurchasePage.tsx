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

type ServicePurchasePageProps = {
  title: string;
  description: ReactNode;
  postPurchaseMessage: ReactNode;
  itemTitle: string;
  creditsLabel: string;
  loadProducts: () => Promise<ServiceProductRow[]>;
  loadErrorMessage: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function ServicePurchasePage({
  title,
  description,
  postPurchaseMessage,
  itemTitle,
  creditsLabel,
  loadProducts,
  loadErrorMessage,
}: ServicePurchasePageProps) {
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ServiceProductRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseOk, setPurchaseOk] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.credits - b.credits),
    [products]
  );

  const selectedProduct = useMemo(
    () => sortedProducts.find((product) => product.id === selectedProductId) ?? null,
    [selectedProductId, sortedProducts]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState('loading');
      setError(null);

      try {
        const items = await loadProducts();
        if (cancelled) return;

        setProducts(items);
        setSelectedProductId(items[0]?.id ?? null);
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
  }, [loadErrorMessage, loadProducts]);

  function openConfirm() {
    setError(null);
    setPurchaseOk(false);

    if (!selectedProduct) {
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

    if (!selectedProduct) {
      setError('Seleziona un pacchetto.');
      setConfirmOpen(false);
      return;
    }

    setPurchasing(true);
    setError(null);
    setPurchaseOk(false);

    try {
      await purchasePassFromProduct({ userId: user.id, product: selectedProduct });
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

            {sortedProducts.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--muted)]">
                Nessun prodotto disponibile.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedProducts.map((product) => {
                  const checked = product.id === selectedProductId;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
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
                              {itemTitle}
                            </div>
                            <div className="ui-muted mt-1">
                              {creditsLabel}: {product.credits}
                            </div>
                          </div>

                          <div className="ui-body font-[var(--font-weight-semibold)] shrink-0">
                            {Number(product.price_eur).toFixed(0)}€
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              variant="primary"
              fullWidth
              onClick={openConfirm}
              disabled={!selectedProduct || purchasing || sortedProducts.length === 0}
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
        {!selectedProduct ? (
          <div className="text-sm text-[var(--muted)]">Seleziona un pacchetto prima di procedere.</div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="text-sm">
                <div className="font-semibold text-[var(--text)]">{selectedProduct.name}</div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  Crediti: <span className="font-semibold text-[var(--text)]">{selectedProduct.credits}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Prezzo:{' '}
                  <span className="font-semibold text-[var(--text)]">{Number(selectedProduct.price_eur).toFixed(0)}€</span>
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
