'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchAdminJson } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { AdminBookingDetail } from '@/lib/admin/types';
import { PrintPensioneCard } from '@/components/admin/PrintPensioneCard';
import '../print.css';

export function PrintBookingClient({ bookingId }: { bookingId: string }) {
  const [detail, setDetail] = useState<AdminBookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminJson<AdminBookingDetail>(`/api/admin/bookings/pensione/${bookingId}`);
        if (cancelled) return;
        setDetail(data);
        // Segna come stampata e apri la stampa.
        await fetchAdminJson(`/api/admin/bookings/pensione/${bookingId}/print`, {
          method: 'POST',
          body: JSON.stringify({}),
        }).catch(() => undefined);
        if (!printedRef.current) {
          printedRef.current = true;
          setTimeout(() => window.print(), 400);
        }
      } catch (err) {
        if (!cancelled) setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare la prenotazione.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

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
      {detail ? <PrintPensioneCard detail={detail} /> : !error ? <div>Caricamento…</div> : null}
    </div>
  );
}
