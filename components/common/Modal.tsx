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
        className="ui-modalOverlay"
        onClick={onClose}
      />

      {/* container: SEMPRE sopra (cliccabile) */}
      <div
        role="dialog"
        aria-modal="true"
        className="ui-modalPanel"
      >
        {/* header */}
        <div className="ui-modalHeader">
          <div className="ui-modalTitle">{title}</div>
          <Button variant="secondary" className="ui-btnCompact" onClick={onClose}>
            Chiudi
          </Button>
        </div>

        {/* body scrollable — padding-bottom per non finire sotto la bottom nav su mobile */}
        <div className="ui-modalBody ui-modalBody--mobile-safe">{children}</div>
      </div>
    </div>
  );
}
