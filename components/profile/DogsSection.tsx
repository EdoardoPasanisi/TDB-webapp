import type { FormEvent } from 'react';
import type { Dog as DogRow } from '@/types/dog';
import type { DogFormState, DogSize } from '@/types/forms';
import { BreedCombobox } from '@/components/dogs/BreedCombobox';
import { Button } from '@/components/ui/Button';
import type { DogBreed } from '@/data/dogBreeds';

interface DogsSectionProps {
  dogs: DogRow[];
  dogEditingId: string | 'new' | null;
  dogForm: DogFormState;
  savingDog: boolean;
  deletingDogId: string | null;

  onChange: (field: keyof DogFormState, value: string) => void;

  /**
   * Quando selezioniamo una razza dalla lista, oltre al valore testuale
   * vogliamo anche poter aggiornare la taglia (auto-compilata) e salvare
   * la difficoltà lavaggio lato DB.
   */
  onBreedSelected: (breedName: string, meta?: DogBreed) => void;

  onStartNewDog: () => void;
  onStartEditDog: (dog: DogRow) => void;
  onSubmit: (event: FormEvent) => void;
  onCancelEdit: () => void;
  onDeleteDog: (id: string) => void;
}

/**
 * Sezione "I miei cani" del profilo.
 * Componente presentational:
 * - non parla con Supabase
 * - riceve dati + handler dalla pagina
 */
export function DogsSection({
  dogs,
  dogEditingId,
  dogForm,
  savingDog,
  deletingDogId,
  onChange,
  onBreedSelected,
  onStartNewDog,
  onStartEditDog,
  onSubmit,
  onCancelEdit,
  onDeleteDog,
}: DogsSectionProps) {
  const isEditing = dogEditingId === 'new' || dogEditingId !== null;

  const sizeOptions: { value: DogSize; label: string }[] = [
    { value: 'toy', label: 'Toy' },
    { value: 'piccola', label: 'Piccola' },
    { value: 'media', label: 'Media' },
    { value: 'grande', label: 'Grande' },
    { value: 'gigante', label: 'Gigante' },
  ];

  return (
    <section className="ui-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="ui-h2">I miei cani</h2>
        <Button
          type="button"
          variant="secondary"
          onClick={onStartNewDog}
          className="ui-btnCompact"
        >
          Aggiungi cane
        </Button>
      </div>

      {dogs.length === 0 && !isEditing && (
        <div className="ui-emptyState ui-muted">
          <p>Non hai ancora registrato nessun cane.</p>
          <p className="mt-1">
            Clicca su &quot;Aggiungi cane&quot; per inserire il primo.
          </p>
        </div>
      )}

      {isEditing && (
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block ui-label mb-1">Nome</label>
              <input
                type="text"
                value={dogForm.name}
                onChange={(e) => onChange('name', e.target.value)}
                className="ui-control ui-input"
              />
            </div>

            <div>
              <label className="block ui-label mb-1">Razza</label>
              <BreedCombobox
                value={dogForm.breed}
                onChange={(next, meta) => onBreedSelected(next, meta)}
                placeholder="Cerca razza..."
              />
              <p className="mt-1 ui-note">
                Suggerimento: scegli una razza dalla lista per auto-impostare la taglia.
              </p>
            </div>
          </div>

          <div>
            <label className="block ui-label mb-1">Taglia</label>
            <select
              value={dogForm.size}
              onChange={(e) => onChange('size', e.target.value)}
              className="ui-control ui-select"
            >
              {sizeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block ui-label mb-1">Microchip</label>
            <input
              type="text"
              value={dogForm.microchip}
              onChange={(e) => onChange('microchip', e.target.value)}
              className="ui-control ui-input"
            />
          </div>

          <div>
            <label className="block ui-label mb-1">Data di nascita</label>
            <input
              type="date"
              value={dogForm.birth_date}
              onChange={(e) => onChange('birth_date', e.target.value)}
              className="ui-control ui-input"
            />
          </div>

          <div>
            <label className="block ui-label mb-1">Note</label>
            <textarea
              value={dogForm.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              className="ui-control ui-textarea min-h-[80px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={savingDog}
              className="ui-btnCompact"
            >
              {savingDog ? 'Salvataggio...' : 'Salva cane'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancelEdit}
              className="ui-btnCompact"
            >
              Annulla
            </Button>
          </div>
        </form>
      )}

      {dogs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {dogs.map((dog) => (
            <li
              key={dog.id}
              className="ui-listRow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="ui-body">
                <p className="font-[var(--font-weight-semibold)]">{dog.name}</p>
                <p className="ui-muted">
                  {(dog.breed || 'Razza non specificata') + (dog.size_category ? ` • ${dog.size_category}` : '')}
                </p>
                {dog.birth_date && (
                  <p className="ui-muted">Nato il: {dog.birth_date}</p>
                )}
                {dog.microchip && (
                  <p className="ui-muted">Microchip: {dog.microchip}</p>
                )}
                {dog.notes && <p className="ui-muted">Note: {dog.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onStartEditDog(dog)}
                  className="ui-btnCompact"
                >
                  Modifica
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => onDeleteDog(dog.id)}
                  disabled={deletingDogId === dog.id}
                  className="ui-btnCompact"
                >
                  {deletingDogId === dog.id ? 'Eliminazione...' : 'Elimina'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
