'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { cancelPensioneBooking } from '@/lib/services/pensione/api';

type Props = {
  bookingId: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export function BookingActions({ bookingId }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEdit = () => {
    // Pensione: edit via query param
    router.push(`/services/pensione?editBookingId=${encodeURIComponent(bookingId)}`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      await cancelPensioneBooking(bookingId);

      setConfirmOpen(false);
      router.push('/services');
    } catch (error) {
      setDeleteError(getErrorMessage(error, 'Errore durante l’eliminazione.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className="ui-panel p-4 flex flex-col sm:flex-row gap-2 justify-end">
        <Button type="button" variant="primary" onClick={handleEdit}>
          Modifica
        </Button>

        <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)}>
          Annulla
        </Button>
      </section>

      <Modal
        open={confirmOpen}
        title="Annulla prenotazione"
        onClose={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setDeleteError(null);
        }}
      >
        <div className="space-y-4">
          <p className="ui-body">
            Vuoi annullare questa prenotazione? La prenotazione resterà nello storico con stato annullato.
          </p>

          {deleteError ? (
            <div className="ui-error">
              {deleteError}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setConfirmOpen(false);
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              Annulla
            </Button>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Annullamento…' : 'Conferma annullamento'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
