'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/ui/Button';

type Props = {
  bookingId: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
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
      // Elimina prima booking_dogs poi booking
      const { error: dogsError } = await supabase
        .from('booking_dogs')
        .delete()
        .eq('booking_id', bookingId);

      if (dogsError) {
        setDeleteError(`Errore eliminazione dettaglio cani: ${dogsError.message}`);
        return;
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (bookingError) {
        setDeleteError(`Errore eliminazione prenotazione: ${bookingError.message}`);
        return;
      }

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
          Elimina
        </Button>
      </section>

      <Modal
        open={confirmOpen}
        title="Elimina prenotazione"
        onClose={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setDeleteError(null);
        }}
      >
        <div className="space-y-4">
          <p className="ui-body">
            Vuoi eliminare questa prenotazione? L’operazione non può essere annullata.
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
              {deleting ? 'Eliminazione…' : 'Conferma eliminazione'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
