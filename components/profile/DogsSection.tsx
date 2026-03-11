import type { FormEvent } from 'react';
import type { Dog as DogRow } from '@/types/dog';
import type { DogFormState, DogSize } from '@/types/forms';
import { BreedCombobox } from '@/components/dogs/BreedCombobox';
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
    <section className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">I miei cani</h2>
        <button
          type="button"
          onClick={onStartNewDog}
          className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
        >
          Aggiungi cane
        </button>
      </div>

      {dogs.length === 0 && !isEditing && (
        <div className="border border-dashed border-gray-300 rounded p-4 text-sm text-gray-700 text-center">
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
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                type="text"
                value={dogForm.name}
                onChange={(e) => onChange('name', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Razza
              </label>
              <BreedCombobox
                value={dogForm.breed}
                onChange={(next, meta) => onBreedSelected(next, meta)}
                placeholder="Cerca razza..."
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Suggerimento: scegli una razza dalla lista per auto-impostare la taglia.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Taglia
            </label>
            <select
              value={dogForm.size}
              onChange={(e) => onChange('size', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {sizeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Microchip
            </label>
            <input
              type="text"
              value={dogForm.microchip}
              onChange={(e) => onChange('microchip', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Data di nascita
            </label>
            <input
              type="date"
              value={dogForm.birth_date}
              onChange={(e) => onChange('birth_date', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={dogForm.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={savingDog}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {savingDog ? 'Salvataggio...' : 'Salva cane'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {dogs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {dogs.map((dog) => (
            <li
              key={dog.id}
              className="border border-gray-200 rounded p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="text-sm">
                <p className="font-medium">{dog.name}</p>
                <p className="text-xs text-gray-700">
                  {(dog.breed || 'Razza non specificata') + (dog.size_category ? ` • ${dog.size_category}` : '')}
                </p>
                {dog.birth_date && (
                  <p className="text-xs text-gray-700">Nato il: {dog.birth_date}</p>
                )}
                {dog.microchip && (
                  <p className="text-xs text-gray-700">Microchip: {dog.microchip}</p>
                )}
                {dog.notes && <p className="text-xs text-gray-700">Note: {dog.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStartEditDog(dog)}
                  className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Modifica
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDog(dog.id)}
                  disabled={deletingDogId === dog.id}
                  className="text-xs px-3 py-1 rounded border border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingDogId === dog.id ? 'Eliminazione...' : 'Elimina'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
