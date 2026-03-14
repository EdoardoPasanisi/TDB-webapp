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

  const toneClass =
    kind === 'success'
      ? 'ui-toastCard--success'
      : kind === 'error'
      ? 'ui-toastCard--error'
      : 'ui-toastCard--info';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* backdrop */}
      <div className="ui-overlayBackdrop" onClick={onClose} />

      {/* modal */}
      <div
        className={`relative mx-4 w-full max-w-md ui-toastCard ${toneClass}`}
        role="dialog"
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ui-toastTitle">{title}</p>
            <p className="ui-toastMessage">{message}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btnTone-secondary ui-btnCompact ui-btnIcon"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
