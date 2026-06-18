'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchAdminJson } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { AdminBookingDetail } from '@/lib/admin/types';
import { PrintPensioneCard } from '@/components/admin/PrintPensioneCard';
import './print.css';

export function PrintQueueClient() {
  const [items, setItems] = useState<AdminBookingDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminJson<{ items: AdminBookingDetail[] }>('/api/admin/print/pensione');
        if (cancelled) return;
        setItems(data.items);
        if (data.items.length > 0) {
          await fetchAdminJson('/api/admin/print/pensione', {
            method: 'POST',
            body: JSON.stringify({ bookingIds: data.items.map((item) => item.id) }),
          }).catch(() => undefined);
          if (!printedRef.current) {
            printedRef.current = true;
            setTimeout(() => window.print(), 500);
          }
        }
      } catch (err) {
        if (!cancelled) setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare le prenotazioni da stampare.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="print-root">
      <div className="print-toolbar">
        <button type="button" className="ui-btn ui-btnTone-primary ui-btnCompact" onClick={() => window.print()}>
          Stampa
        </button>
        <button type="button" className="ui-btn ui-btnTone-secondary ui-btnCompact" onClick={() => window.close()}>
          Chiudi
        </button>
      </div>
      {error ? <div className="ui-error">{error}</div> : null}
      {items && items.length === 0 ? <div>Nessuna prenotazione da stampare.</div> : null}
      {items?.map((detail, index) => (
        <div key={detail.id} className={index < items.length - 1 ? 'print-page-break' : undefined}>
          <PrintPensioneCard detail={detail} />
        </div>
      ))}
      {!items && !error ? <div>Caricamento…</div> : null}
    </div>
  );
}
