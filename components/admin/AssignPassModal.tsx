'use client';

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ModalFrame, LoadingCard, formatEuro } from '@/components/admin/shared';

type AdminServiceProduct = {
  id: string;
  serviceType: string;
  serviceVariant: string | null;
  name: string;
  credits: number;
  priceEur: number;
};

export function AssignPassModal({
  open,
  userId,
  onClose,
  onAssigned,
}: {
  open: boolean;
  userId: string | null;
  onClose: () => void;
  onAssigned: () => void | Promise<void>;
}) {
  const [products, setProducts] = useState<AdminServiceProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchAdminJson<{ items: AdminServiceProduct[] }>('/api/admin/products', { signal: controller.signal })
      .then((data) => {
        setProducts(data.items);
        setProductId(data.items[0]?.id ?? '');
        setLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i pacchetti.'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [open]);

  const handleSubmit = async () => {
    if (!userId || !productId) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/users/${userId}/passes`, {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      await onAssigned();
      onClose();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti ad assegnare il pacchetto.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalFrame open={open} title="Assegna pacchetto / crediti" onClose={onClose}>
      {loading ? (
        <LoadingCard label="Caricamento pacchetti..." />
      ) : (
        <div className="space-y-4">
          {error ? <div className="ui-error">{error}</div> : null}
          <div className="ui-muted">
            Il prezzo del pacchetto entra nel saldo del cliente. I pacchetti multi-credito di asilo/addestramento/consulenza
            nascono bloccati finché non confermi il pagamento.
          </div>
          <Field label="Pacchetto">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="ui-control ui-select">
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.credits} crediti · {formatEuro(product.priceEur)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Annulla
            </Button>
            <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={submitting || !productId}>
              {submitting ? 'Assegnazione…' : 'Assegna'}
            </Button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
}
