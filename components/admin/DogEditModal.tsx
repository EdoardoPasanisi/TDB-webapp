'use client';

import { useState } from 'react';
import { fetchAdminJson } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { DogForm } from '@/components/dogs/DogForm';
import { ModalFrame } from '@/components/admin/shared';
import { useConfirm } from '@/components/admin/ConfirmProvider';
import type { Dog, DogInput } from '@/types/dog';

/**
 * Crea o modifica un cane dal gestionale, riusando DogForm.
 * La size viene comunque derivata server-side dalla razza (findDogBreed).
 */
export function DogEditModal({
  open,
  mode,
  ownerId,
  dog,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  ownerId?: string | null;
  dog?: Dog | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const handleSubmit = async (input: DogInput) => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'create') {
        if (!ownerId) throw new Error('Proprietario non valido.');
        await fetchAdminJson('/api/admin/dogs', {
          method: 'POST',
          body: JSON.stringify({ ...input, ownerId }),
        });
      } else {
        if (!dog) throw new Error('Cane non valido.');
        await fetchAdminJson(`/api/admin/dogs/${dog.id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare il cane.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!dog) return;
    const ok = await confirm({
      keyword: 'ELIMINA',
      title: `Elimina ${dog.name}`,
      message: 'Il cane verrà rimosso dal cliente. Lo storico delle prenotazioni resta consultabile.',
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/dogs/${dog.id}`, { method: 'DELETE' });
      await onSaved();
      onClose();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare il cane.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalFrame
      open={open}
      title={mode === 'create' ? 'Aggiungi cane' : `Modifica ${dog?.name ?? 'cane'}`}
      onClose={onClose}
    >
      {error ? <div className="ui-error">{error}</div> : null}
      <DogForm
        mode={mode}
        initialDog={dog ?? null}
        onSubmit={handleSubmit}
        submitting={submitting}
        deleting={deleting}
        photoEnabled={false}
        allowManualSize
        onCancel={onClose}
        onDelete={mode === 'edit' ? handleDelete : undefined}
      />
    </ModalFrame>
  );
}
