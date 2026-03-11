// FILE: components/common/Modal.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: Props) {
  // Escape + blocco scroll pagina sotto
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      {/* overlay: SEMPRE sotto */}
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 z-0 bg-black/60"
        onClick={onClose}
      />

      {/* container: SEMPRE sopra (cliccabile) */}
      <div
        role="dialog"
        aria-modal="true"
        className={[
          'relative z-10 w-full md:max-w-3xl',
          'bg-[var(--surface)] text-[var(--text)]',
          'border border-[var(--border)] shadow-[var(--shadow)]',
          'rounded-t-2xl md:rounded-2xl',
          'max-h-[85vh] flex flex-col',
        ].join(' ')}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 shrink-0">
          <div className="min-w-0 text-sm font-semibold truncate">{title}</div>
          <Button variant="ghost" onClick={onClose}>
            Chiudi
          </Button>
        </div>

        {/* body scrollable */}
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}