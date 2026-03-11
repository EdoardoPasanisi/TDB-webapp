'use client';

import { useMemo, useState } from 'react';
import type { Dog } from '@/types/dog';
import type { PublicDogCardOwner } from '@/components/dogs/DogPublicCard';

type DogPrefs = {
  show_breed: boolean;
  show_sex: boolean;
  show_size: boolean;
  show_microchip: boolean;
  show_birth_date: boolean;
  show_notes: boolean;
  show_coat_color: boolean;
  show_temperament: boolean;
};

type OwnerPrefs = {
  show_first_name_on_dog_card: boolean;
  show_last_name_on_dog_card: boolean;
  show_phone_on_dog_card: boolean;
  show_email_on_dog_card: boolean;
  show_address_on_dog_card: boolean;
  show_dog_address_on_dog_card: boolean;
};

type PreferencesAvailability<T extends string> = Record<T, boolean>;

type DogPrefKey = keyof DogPrefs;
type OwnerPrefKey = keyof OwnerPrefs;

type Props = {
  open: boolean;
  dog: Dog;
  owner: PublicDogCardOwner | null;
  saving: boolean;
  onClose: () => void;
  onSave: (nextDogPrefs: DogPrefs, nextOwnerPrefs: OwnerPrefs) => Promise<void>;
};

type PreferenceItemProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  saving: boolean;
  onChange: (value: boolean) => void;
};

function boolOr(value: boolean | null | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function hasAnyAddress(line: string | null, city: string | null, zip: string | null, prov: string | null): boolean {
  return !!(line || city || zip || prov);
}

function buildInitialDogPrefs(dog: Dog): DogPrefs {
  return {
    show_breed: boolOr(dog.show_breed, true),
    show_sex: boolOr(dog.show_sex, true),
    show_size: boolOr(dog.show_size, false),
    show_microchip: boolOr(dog.show_microchip, false),
    show_birth_date: boolOr(dog.show_birth_date, false),
    show_notes: boolOr(dog.show_notes, false),
    show_coat_color: boolOr(dog.show_coat_color, false),
    show_temperament: boolOr(dog.show_temperament, false),
  };
}

function buildInitialOwnerPrefs(owner: PublicDogCardOwner | null): OwnerPrefs {
  return {
    show_first_name_on_dog_card: boolOr(owner?.show_first_name_on_dog_card, true),
    show_last_name_on_dog_card: boolOr(owner?.show_last_name_on_dog_card, true),
    show_phone_on_dog_card: boolOr(owner?.show_phone_on_dog_card, true),
    show_email_on_dog_card: boolOr(owner?.show_email_on_dog_card, false),
    show_address_on_dog_card: boolOr(owner?.show_address_on_dog_card, false),
    show_dog_address_on_dog_card: boolOr(owner?.show_dog_address_on_dog_card, false),
  };
}

function PreferenceItem({
  label,
  description,
  checked,
  disabled,
  saving,
  onChange,
}: PreferenceItemProps) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded border ${
        disabled ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:bg-gray-50'
      } cursor-pointer`}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        disabled={disabled || saving}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="min-w-0">
        <div className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>{label}</div>
        <div className={`text-xs ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>{description}</div>
      </div>
    </label>
  );
}

function DogCardPreferencesDialog({
  dog,
  owner,
  saving,
  onClose,
  onSave,
}: Omit<Props, 'open'>) {
  const [dogPrefs, setDogPrefs] = useState<DogPrefs>(() => buildInitialDogPrefs(dog));
  const [ownerPrefs, setOwnerPrefs] = useState<OwnerPrefs>(() => buildInitialOwnerPrefs(owner));

  const dogAvailability = useMemo<PreferencesAvailability<DogPrefKey>>(
    () => ({
      show_breed: isFilled(dog.breed),
      show_sex: isFilled(dog.sex),
      show_size: isFilled(dog.size_category),
      show_microchip: isFilled(dog.microchip),
      show_birth_date: isFilled(dog.birth_date),
      show_notes: isFilled(dog.notes),
      show_coat_color: isFilled(dog.coat_color),
      show_temperament: isFilled(dog.temperament),
    }),
    [dog]
  );

  const ownerAvailability = useMemo<PreferencesAvailability<OwnerPrefKey>>(
    () => ({
      show_first_name_on_dog_card: isFilled(owner?.first_name),
      show_last_name_on_dog_card: isFilled(owner?.last_name),
      show_phone_on_dog_card: isFilled(owner?.phone),
      show_email_on_dog_card: isFilled(owner?.email),
      show_address_on_dog_card: hasAnyAddress(
        owner?.address_line ?? null,
        owner?.city ?? null,
        owner?.zip_code ?? null,
        owner?.province ?? null
      ),
      show_dog_address_on_dog_card: hasAnyAddress(
        owner?.dog_address_line ?? null,
        owner?.dog_city ?? null,
        owner?.dog_zip_code ?? null,
        owner?.dog_province ?? null
      ),
    }),
    [owner]
  );

  const handleSave = async () => {
    const nextDogPrefs: DogPrefs = {
      show_breed: dogAvailability.show_breed ? dogPrefs.show_breed : false,
      show_sex: dogAvailability.show_sex ? dogPrefs.show_sex : false,
      show_size: dogAvailability.show_size ? dogPrefs.show_size : false,
      show_microchip: dogAvailability.show_microchip ? dogPrefs.show_microchip : false,
      show_birth_date: dogAvailability.show_birth_date ? dogPrefs.show_birth_date : false,
      show_notes: dogAvailability.show_notes ? dogPrefs.show_notes : false,
      show_coat_color: dogAvailability.show_coat_color ? dogPrefs.show_coat_color : false,
      show_temperament: dogAvailability.show_temperament ? dogPrefs.show_temperament : false,
    };

    const nextOwnerPrefs: OwnerPrefs = {
      show_first_name_on_dog_card: ownerAvailability.show_first_name_on_dog_card
        ? ownerPrefs.show_first_name_on_dog_card
        : false,
      show_last_name_on_dog_card: ownerAvailability.show_last_name_on_dog_card
        ? ownerPrefs.show_last_name_on_dog_card
        : false,
      show_phone_on_dog_card: ownerAvailability.show_phone_on_dog_card ? ownerPrefs.show_phone_on_dog_card : false,
      show_email_on_dog_card: ownerAvailability.show_email_on_dog_card ? ownerPrefs.show_email_on_dog_card : false,
      show_address_on_dog_card: ownerAvailability.show_address_on_dog_card ? ownerPrefs.show_address_on_dog_card : false,
      show_dog_address_on_dog_card: ownerAvailability.show_dog_address_on_dog_card
        ? ownerPrefs.show_dog_address_on_dog_card
        : false,
    };

    await onSave(nextDogPrefs, nextOwnerPrefs);
  };

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Chiudi" />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl max-h-[85vh] overflow-auto">
          <div className="p-4 border-b border-gray-200 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Personalizza scheda cane</h2>
              <p className="text-xs text-gray-600 mt-1">
                Scegli cosa mostrare nella scheda pubblica del cane (quella del QR).
              </p>
            </div>
            <button
              type="button"
              className="px-3 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
              onClick={onClose}
              disabled={saving}
            >
              Chiudi
            </button>
          </div>

          <div className="p-4 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Informazioni del cane</h3>
              <div className="grid grid-cols-1 gap-2">
                <PreferenceItem
                  label="Razza"
                  description={
                    dogAvailability.show_breed ? 'Mostra la razza sulla scheda.' : 'Compila prima la razza per poterla mostrare.'
                  }
                  checked={dogPrefs.show_breed}
                  disabled={!dogAvailability.show_breed}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_breed: value }))}
                />
                <PreferenceItem
                  label="Sesso"
                  description={
                    dogAvailability.show_sex ? 'Mostra il sesso sulla scheda.' : 'Compila prima il sesso per poterlo mostrare.'
                  }
                  checked={dogPrefs.show_sex}
                  disabled={!dogAvailability.show_sex}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_sex: value }))}
                />
                <PreferenceItem
                  label="Taglia"
                  description={dogAvailability.show_size ? 'Mostra la taglia.' : 'Compila prima la taglia per poterla mostrare.'}
                  checked={dogPrefs.show_size}
                  disabled={!dogAvailability.show_size}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_size: value }))}
                />
                <PreferenceItem
                  label="Data di nascita"
                  description={
                    dogAvailability.show_birth_date ? 'Mostra la data di nascita.' : 'Compila prima la data di nascita.'
                  }
                  checked={dogPrefs.show_birth_date}
                  disabled={!dogAvailability.show_birth_date}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_birth_date: value }))}
                />
                <PreferenceItem
                  label="Microchip"
                  description={dogAvailability.show_microchip ? 'Mostra il microchip.' : 'Compila prima il microchip.'}
                  checked={dogPrefs.show_microchip}
                  disabled={!dogAvailability.show_microchip}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_microchip: value }))}
                />
                <PreferenceItem
                  label="Colore mantello"
                  description={
                    dogAvailability.show_coat_color ? 'Mostra il colore del mantello.' : 'Compila prima il colore del mantello.'
                  }
                  checked={dogPrefs.show_coat_color}
                  disabled={!dogAvailability.show_coat_color}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_coat_color: value }))}
                />
                <PreferenceItem
                  label="Carattere"
                  description={dogAvailability.show_temperament ? 'Mostra il carattere.' : 'Compila prima il carattere.'}
                  checked={dogPrefs.show_temperament}
                  disabled={!dogAvailability.show_temperament}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_temperament: value }))}
                />
                <PreferenceItem
                  label="Note"
                  description={dogAvailability.show_notes ? 'Mostra le note.' : 'Compila prima le note.'}
                  checked={dogPrefs.show_notes}
                  disabled={!dogAvailability.show_notes}
                  saving={saving}
                  onChange={(value) => setDogPrefs((current) => ({ ...current, show_notes: value }))}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Informazioni del proprietario</h3>
              <p className="text-xs text-gray-600">Queste informazioni vengono prese dal profilo utente.</p>

              <div className="grid grid-cols-1 gap-2">
                <PreferenceItem
                  label="Nome"
                  description={
                    ownerAvailability.show_first_name_on_dog_card
                      ? 'Mostra il nome del proprietario.'
                      : 'Compila prima il nome del proprietario (Account).'
                  }
                  checked={ownerPrefs.show_first_name_on_dog_card}
                  disabled={!ownerAvailability.show_first_name_on_dog_card}
                  saving={saving}
                  onChange={(value) =>
                    setOwnerPrefs((current) => ({ ...current, show_first_name_on_dog_card: value }))
                  }
                />
                <PreferenceItem
                  label="Cognome"
                  description={
                    ownerAvailability.show_last_name_on_dog_card
                      ? 'Mostra il cognome del proprietario.'
                      : 'Compila prima il cognome del proprietario (Account).'
                  }
                  checked={ownerPrefs.show_last_name_on_dog_card}
                  disabled={!ownerAvailability.show_last_name_on_dog_card}
                  saving={saving}
                  onChange={(value) =>
                    setOwnerPrefs((current) => ({ ...current, show_last_name_on_dog_card: value }))
                  }
                />
                <PreferenceItem
                  label="Telefono"
                  description={ownerAvailability.show_phone_on_dog_card ? 'Mostra il telefono.' : 'Compila prima il telefono (Account).'}
                  checked={ownerPrefs.show_phone_on_dog_card}
                  disabled={!ownerAvailability.show_phone_on_dog_card}
                  saving={saving}
                  onChange={(value) => setOwnerPrefs((current) => ({ ...current, show_phone_on_dog_card: value }))}
                />
                <PreferenceItem
                  label="Email"
                  description={ownerAvailability.show_email_on_dog_card ? 'Mostra l’email.' : 'Compila prima l’email (Account).'}
                  checked={ownerPrefs.show_email_on_dog_card}
                  disabled={!ownerAvailability.show_email_on_dog_card}
                  saving={saving}
                  onChange={(value) => setOwnerPrefs((current) => ({ ...current, show_email_on_dog_card: value }))}
                />
                <PreferenceItem
                  label="Indirizzo di casa"
                  description={
                    ownerAvailability.show_address_on_dog_card
                      ? 'Mostra l’indirizzo di casa.'
                      : 'Compila prima l’indirizzo di casa (Account).'
                  }
                  checked={ownerPrefs.show_address_on_dog_card}
                  disabled={!ownerAvailability.show_address_on_dog_card}
                  saving={saving}
                  onChange={(value) => setOwnerPrefs((current) => ({ ...current, show_address_on_dog_card: value }))}
                />
                <PreferenceItem
                  label="Indirizzo ritiro/servizi"
                  description={
                    ownerAvailability.show_dog_address_on_dog_card
                      ? 'Mostra l’indirizzo di ritiro/servizi.'
                      : 'Compila prima l’indirizzo ritiro/servizi (Account).'
                  }
                  checked={ownerPrefs.show_dog_address_on_dog_card}
                  disabled={!ownerAvailability.show_dog_address_on_dog_card}
                  saving={saving}
                  onChange={(value) =>
                    setOwnerPrefs((current) => ({ ...current, show_dog_address_on_dog_card: value }))
                  }
                />
              </div>
            </section>
          </div>

          <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
              onClick={onClose}
              disabled={saving}
            >
              Annulla
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DogCardPreferencesModal({ open, dog, owner, saving, onClose, onSave }: Props) {
  if (!open) return null;

  return (
    <DogCardPreferencesDialog
      key={`${dog.id}:${owner?.id ?? 'no-owner'}`}
      dog={dog}
      owner={owner}
      saving={saving}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
