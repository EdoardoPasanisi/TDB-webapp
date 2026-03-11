// components/common/Toast.tsx
'use client';

import { useEffect } from 'react';

type Kind = 'success' | 'error' | 'info';

export function Toast({
  message,
  onClose,
  kind = 'info',
  autoCloseMs = 1600,
}: {
  message: string;
  onClose: () => void;
  kind?: Kind;
  autoCloseMs?: number;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => onClose(), autoCloseMs);
    return () => window.clearTimeout(t);
  }, [autoCloseMs, onClose]);

  const title =
    kind === 'success' ? 'Operazione riuscita' : kind === 'error' ? 'Errore' : 'Avviso';

  const border =
    kind === 'success'
      ? 'border-green-200'
      : kind === 'error'
      ? 'border-red-200'
      : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* modal */}
      <div
        className={`relative mx-4 w-full max-w-md rounded-xl border ${border} bg-white p-5 shadow-xl`}
        role="dialog"
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-1 text-sm text-gray-700">{message}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-xs font-semibold hover:bg-gray-50"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
