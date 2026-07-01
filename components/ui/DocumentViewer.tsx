'use client';

import { useEffect } from 'react';

// Viewer "in-app" per documenti (immagini e PDF). Sostituisce l'apertura del
// signed URL in una nuova scheda: nella WebView Capacitor quella diventava una
// pagina bianca senza modo di tornare indietro. Qui restiamo dentro l'app, con
// una barra in alto e un pulsante "Indietro" sempre visibile.

export type DocumentViewerSource = {
  src: string;
  title: string;
  isPdf: boolean;
};

export function DocumentViewer({
  source,
  onClose,
}: {
  source: DocumentViewerSource | null;
  onClose: () => void;
}) {
  const open = !!source;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // Blocca lo scroll del body mentre il viewer è aperto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!source) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[rgba(6,8,12,0.94)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={source.title}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-white/10 px-3 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="ui-btn ui-btnSecondary ui-btnCompact inline-flex items-center gap-1.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Indietro
        </button>

        <div className="min-w-0 flex-1 truncate text-center ui-body font-[var(--font-weight-semibold)]">
          {source.title}
        </div>

        {/* Fallback: apre in una scheda del browser esterno (utile per PDF). */}
        <a
          href={source.src}
          target="_blank"
          rel="noreferrer"
          className="ui-btn ui-btnSecondary ui-btnCompact"
        >
          Apri
        </a>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {source.isPdf ? (
          <iframe
            src={source.src}
            title={source.title}
            className="h-full w-full rounded-[var(--radius)] border border-white/10 bg-white"
          />
        ) : (
          <div className="flex min-h-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={source.src}
              alt={source.title}
              className="max-h-full max-w-full rounded-[var(--radius)] object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
