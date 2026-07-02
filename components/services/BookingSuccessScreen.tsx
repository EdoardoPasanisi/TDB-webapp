'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

// Schermata di conferma prenotazione a schermo intero. Non sparisce da sola:
// l'utente deve interagire (Vai al calendario / Chiudi / Esc) per uscire, così
// è chiaro che la prenotazione è andata a buon fine.
export function BookingSuccessScreen({
  open,
  onClose,
  title = 'Prenotazione effettuata correttamente',
  message = 'Puoi vedere tutti i dettagli nella pagina Calendario.',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[rgba(6,8,12,0.96)] px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(80,255,160,0.4)] bg-[rgba(80,255,160,0.14)]">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 6L9 17l-5-5"
              stroke="#7dffb4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 className="ui-h2 mt-5">{title}</h2>
        <p className="ui-muted mt-2">{message}</p>

        <div className="mt-7 flex w-full flex-col gap-2">
          <Button variant="primary" fullWidth onClick={() => router.push('/services/calendar')}>
            Vai al calendario
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </div>
    </div>
  );
}
