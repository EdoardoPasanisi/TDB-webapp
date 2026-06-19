// components/dogs/DogForm.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DOG_BREEDS,
  type DogBreed,
  type GroomingDifficulty,
  type SizeCategory,
} from '@/data/dogBreeds';
import { CAT_BREEDS } from '@/data/catBreeds';
import { findBreedProfileForSpecies } from '@/data/petBreeds';
import { temperamentOptionsForSpecies, genderedTemperamentLabel } from '@/data/petTemperaments';
import { BreedSearchInput } from '@/components/dogs/BreedSearchInput';
import type { Dog, DogInput, DogSex, PetSpecies } from '@/types/dog';
import { isValidMicrochip, sanitizeMicrochip } from '@/lib/validation/italy';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';

const SIZE_OPTIONS: { value: SizeCategory; label: string }[] = [
  { value: 'toy', label: 'Toy' },
  { value: 'piccola', label: 'Piccola' },
  { value: 'media', label: 'Media' },
  { value: 'grande', label: 'Grande' },
  { value: 'gigante', label: 'Gigante' },
];

const SPECIES_OPTIONS: { value: PetSpecies; label: string }[] = [
  { value: 'DOG', label: 'Cane' },
  { value: 'CAT', label: 'Gatto' },
  { value: 'OTHER', label: 'Altro' },
];

function parseBirthDate(value: string | null): { y: number | null; m: number | null; d: number | null } {
  if (!value) return { y: null, m: null, d: null };
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { y: null, m: null, d: null };
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/**
 * ✅ Requisito: anno obbligatorio, mese/giorno facoltativi.
 * DB è `date`, quindi se manca mese/giorno salviamo default `01-01`.
 */
function buildBirthDate(y: number | null, m: number | null, d: number | null): string | null {
  if (!y) return null;
  if (!m || !d) return `${y}-01-01`;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface DogFormProps {
  mode: 'create' | 'edit';
  initialDog?: Dog | null;
  onSubmit: (input: DogInput) => Promise<void> | void;

  onCancel?: () => void;
  onDelete?: () => Promise<void> | void;
  onPhotoRemove?: () => Promise<void> | void;

  submitting: boolean;
  deleting?: boolean;

  initialPhotoUrl?: string | null;
  onPhotoSelected?: (file: File | null) => void;
  photoUploading?: boolean;
  photoEnabled?: boolean;
  allowManualSize?: boolean;

  // Specie pre-selezionata (es. dal selettore tipo pet) e blocco del selettore in form.
  initialSpecies?: PetSpecies;
  lockSpecies?: boolean;
}

export function DogForm({
  mode,
  initialDog,
  onSubmit,
  onCancel,
  onDelete,
  submitting,
  deleting,
  onPhotoRemove,

  initialPhotoUrl = null,
  onPhotoSelected,
  photoUploading = false,
  photoEnabled = true,
  allowManualSize = false,
  initialSpecies = 'DOG',
  lockSpecies = false,
}: DogFormProps) {
  const isEdit = mode === 'edit';
  const editableDog = isEdit ? initialDog ?? null : null;
  const initialBirthParts = parseBirthDate(editableDog?.birth_date ?? null);

  // Specie
  const [species, setSpecies] = useState<PetSpecies>(editableDog?.species ?? initialSpecies);
  const [speciesOther, setSpeciesOther] = useState(editableDog?.species_other ?? '');

  const initialBreedProfile = findBreedProfileForSpecies(species, editableDog?.breed ?? null);

  // Required
  const [name, setName] = useState(editableDog?.name ?? '');
  const [breed, setBreed] = useState(editableDog?.breed ?? '');
  const [sizeCategory, setSizeCategory] = useState<SizeCategory | null>(
    editableDog?.size_category ?? initialBreedProfile?.size ?? null
  );

  // Nome sul libretto (solo cani; default = nome finché non modificato)
  const [librettoName, setLibrettoName] = useState(editableDog?.libretto_name ?? editableDog?.name ?? '');
  const [librettoTouched, setLibrettoTouched] = useState(
    Boolean(editableDog?.libretto_name && editableDog.libretto_name !== editableDog.name)
  );

  // Business-only
  const [groomingDifficulty, setGroomingDifficulty] = useState<GroomingDifficulty | null>(
    editableDog?.grooming_difficulty ?? initialBreedProfile?.washDifficulty ?? null,
  );

  const [sex, setSex] = useState<DogSex | null>(editableDog?.sex ?? null);

  const [microchip, setMicrochip] = useState(editableDog?.microchip ?? '');
  const [microchipWarning, setMicrochipWarning] = useState<string | null>(null);
  const [notes, setNotes] = useState(editableDog?.notes ?? '');

  const [coatColor, setCoatColor] = useState(editableDog?.coat_color ?? '');
  const [temperament, setTemperament] = useState<string[]>((editableDog?.temperament ?? []) as string[]);

  const [weightKg, setWeightKg] = useState<string>(
    editableDog?.weight_kg != null ? String(editableDog.weight_kg) : '',
  );

  const [originBreeds, setOriginBreeds] = useState<string[]>(
    (editableDog?.origin_breeds ?? []) as string[],
  );

  // Birth date parts
  const [birthY, setBirthY] = useState<number | null>(initialBirthParts.y);
  const [birthM, setBirthM] = useState<number | null>(initialBirthParts.m);
  const [birthD, setBirthD] = useState<number | null>(initialBirthParts.d);

  // Public card toggles
  const showBreed = editableDog?.show_breed ?? true;
  const showSex = editableDog?.show_sex ?? true;
  const showSize = editableDog?.show_size ?? false;
  const showMicrochip = editableDog?.show_microchip ?? false;
  const showBirthDate = editableDog?.show_birth_date ?? false;
  const showNotes = editableDog?.show_notes ?? false;
  const showCoatColor = editableDog?.show_coat_color ?? false;
  const showTemperament = editableDog?.show_temperament ?? false;
  const showWeight = editableDog?.show_weight ?? false;
  const showOriginBreeds = editableDog?.show_origin_breeds ?? false;

  const [formError, setFormError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const isDog = species === 'DOG';
  const isOther = species === 'OTHER';
  const breedList = (species === 'CAT' ? CAT_BREEDS : DOG_BREEDS) as DogBreed[];
  const temperamentOptions = useMemo(() => temperamentOptionsForSpecies(species), [species]);
  const sizeFromBreedOnly = !allowManualSize && !isOther;

  // Mantieni il nome libretto allineato al nome finché l'utente non lo modifica (solo cani).
  function handleNameChange(value: string) {
    setName(value);
    if (isDog && !librettoTouched) setLibrettoName(value);
  }

  function clampBirthDay(y: number | null, m: number | null, d: number | null): number | null {
    if (!y || !m || !d) return d;
    const max = daysInMonth(y, m);
    return d > max ? max : d;
  }

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  function toggleTemperament(option: string) {
    setTemperament((prev) => (prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option]));
  }

  function changeSpecies(next: PetSpecies) {
    setSpecies(next);
    // Reset dei campi specie-dipendenti per evitare incoerenze.
    setBreed('');
    setSizeCategory(null);
    setGroomingDifficulty(null);
    setOriginBreeds([]);
    setTemperament([]);
    if (next !== 'OTHER') setSpeciesOther('');
    if (next !== 'DOG') setMicrochip('');
  }

  function validateRequired(): string[] {
    const errors: string[] = [];
    if (!name.trim()) errors.push('Inserisci il nome del pet.');
    if (isOther) {
      if (!speciesOther.trim()) errors.push('Indica la specie del pet.');
    } else {
      if (!breed.trim()) errors.push('Seleziona la razza.');
      if (!sizeCategory) {
        errors.push(allowManualSize ? 'Seleziona la taglia.' : 'Impossibile determinare la taglia dalla razza selezionata.');
      }
    }
    if (!birthY) errors.push('Seleziona l’anno di nascita.');
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitNotice(null);

    const errors = validateRequired();
    if (errors.length > 0) {
      setFormError(errors.join(' '));
      return;
    }

    // Microchip solo per i cani.
    const microchipDigitsOnly = isDog ? sanitizeMicrochip(microchip).replace(/\D/g, '') : '';
    const microchipIsProvided = microchipDigitsOnly.length > 0;
    const microchipIsValid = !microchipIsProvided ? true : isValidMicrochip(microchipDigitsOnly);

    if (microchipIsProvided && !microchipIsValid) {
      setMicrochipWarning(
        'Il numero di microchip non sembra corretto: deve essere composto da 15 cifre. Il valore non verrà salvato.'
      );
    } else {
      setMicrochipWarning(null);
    }

    const microchipToSave = !isDog
      ? null
      : !microchipIsProvided
        ? null
        : microchipIsValid
          ? microchipDigitsOnly
          : mode === 'edit'
            ? initialDog?.microchip ?? null
            : null;

    const normalizedBirthDay = clampBirthDay(birthY, birthM, birthD);
    const birth_date = buildBirthDate(birthY, birthM, normalizedBirthDay);

    const payload: DogInput = {
      species,
      species_other: isOther ? (speciesOther.trim() || null) : null,
      libretto_name: isDog ? (librettoName.trim() || name.trim()) : null,

      name: name.trim(),
      breed: isOther ? null : breed.trim() || null,

      size_category: sizeCategory,
      grooming_difficulty: groomingDifficulty ?? null,

      sex,

      microchip: microchipToSave,
      birth_date,
      notes: notes.trim() ? notes.trim() : null,

      coat_color: coatColor.trim() ? coatColor.trim() : null,
      temperament: temperament.length > 0 ? temperament : null,

      weight_kg: weightKg.trim() ? Number(weightKg.replace(',', '.')) : null,
      origin_breeds: breed.trim() === 'Meticcio' && originBreeds.length > 0 ? originBreeds : null,

      show_breed: showBreed,
      show_sex: showSex,
      show_size: showSize,
      show_microchip: showMicrochip,
      show_birth_date: showBirthDate,
      show_notes: showNotes,
      show_coat_color: showCoatColor,
      show_temperament: showTemperament,
      show_weight: showWeight,
      show_origin_breeds: showOriginBreeds,
    };

    await onSubmit(payload);

    if (microchipIsProvided && !microchipIsValid) {
      setSubmitNotice('Attenzione: il numero di microchip inserito non è nel formato corretto e non è stato salvato.');
    }
  }

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let y = 2000; y <= currentYear; y += 1) years.push(y);
    return years;
  }, []);

  const maxDay = useMemo(() => {
    if (!birthY || !birthM) return 31;
    return daysInMonth(birthY, birthM);
  }, [birthY, birthM]);

  const effectivePhotoUrl = photoPreviewUrl ?? initialPhotoUrl ?? null;
  const hasSavedPhoto = Boolean(initialPhotoUrl);
  const hasLocalSelection = Boolean(photoPreviewUrl);

  const handlePhotoChange = (file: File | null) => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    const nextPreview = file ? URL.createObjectURL(file) : null;
    setPhotoPreviewUrl(nextPreview);
    onPhotoSelected?.(file);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError ? <div className="ui-error">{formError}</div> : null}

      {submitNotice ? (
        <div className="ui-alertWarn">
          <p className="ui-body">{submitNotice}</p>
        </div>
      ) : null}

      {photoEnabled ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-body font-[var(--font-weight-semibold)]">Foto</p>
                <p className="ui-muted mt-1">Facoltativa. JPG, PNG o WebP.</p>
              </div>
              {photoUploading ? <span className="ui-muted">Caricamento…</span> : null}
            </div>

            <div className="flex items-start gap-3">
              <button
                type="button"
                className="ui-clickable ui-clickableMedia shrink-0"
                style={{ width: 72, height: 72 }}
                title="Carica o cambia foto"
                disabled={photoUploading}
                onClick={() => photoInputRef.current?.click()}
              >
                {effectivePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={effectivePhotoUrl} alt="Foto pet" className="block h-full w-full max-h-full max-w-full object-cover" />
                ) : (
                  <span className="ui-muted">Foto</span>
                )}
              </button>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={photoUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  handlePhotoChange(f);
                }}
                className="sr-only"
              />

              <div className="flex-1 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    disabled={photoUploading}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {hasSavedPhoto ? 'Cambia foto' : 'Carica foto'}
                  </Button>

                  {hasLocalSelection ? (
                    <Button type="button" variant="ghost" fullWidth disabled={photoUploading} onClick={() => handlePhotoChange(null)}>
                      Annulla selezione
                    </Button>
                  ) : hasSavedPhoto && onPhotoRemove ? (
                    <Button type="button" variant="secondary" fullWidth disabled={photoUploading} onClick={() => void onPhotoRemove()}>
                      Rimuovi foto
                    </Button>
                  ) : null}
                </div>

                <p className="ui-muted">Tocca la foto oppure il pulsante per selezionare un’immagine.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Specie (nascosta quando pre-selezionata dal selettore tipo pet) */}
      {!lockSpecies ? (
        <Card>
          <CardContent className="space-y-2">
            <Field label="Tipo di pet" required id="pet-species">
              <select
                id="pet-species"
                value={species}
                onChange={(e) => changeSpecies(e.target.value as PetSpecies)}
                className="ui-control ui-select"
              >
                {SPECIES_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Nome (required) */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Nome" required id="dog-name">
            <input
              id="dog-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="ui-control ui-input"
              placeholder="Es. Luna"
              aria-invalid={!name.trim()}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Nome sul libretto (solo cani) */}
      {isDog ? (
        <Card>
          <CardContent className="space-y-2">
            <Field label="Nome sul libretto" hint="Di default uguale al nome. Obbligatorio per prenotare.">
              <input
                type="text"
                value={librettoName}
                onChange={(e) => {
                  setLibrettoTouched(true);
                  setLibrettoName(e.target.value);
                }}
                className="ui-control ui-input"
                placeholder="Nome riportato sul libretto"
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Specie libera (solo "Altro") */}
      {isOther ? (
        <Card>
          <CardContent className="space-y-2">
            <Field label="Specie" required hint="Indica di che animale si tratta (es. coniglio, furetto…).">
              <input
                type="text"
                value={speciesOther}
                onChange={(e) => setSpeciesOther(e.target.value)}
                className="ui-control ui-input"
                placeholder="Es. Coniglio"
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Razza (cane/gatto) */}
      {!isOther ? (
        <Card>
          <CardContent className="space-y-2">
            <Field label="Razza" required hint="Cerca anche per nomi alternativi." id="dog-breed">
              <BreedSearchInput
                breeds={breedList}
                value={breed}
                onSelect={(b) => {
                  setBreed(b.name);
                  setSizeCategory(b.size);
                  setGroomingDifficulty(b.washDifficulty);
                }}
                onClear={() => {
                  setBreed('');
                  setSizeCategory(null);
                  setGroomingDifficulty(null);
                }}
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Razze d'origine (solo meticci, facoltative) */}
      {!isOther && breed.trim() === 'Meticcio' ? (
        <Card>
          <CardContent className="space-y-2">
            <Field label="Razze d'origine" hint="Facoltative. Aggiungi le razze presenti nel meticcio.">
              <div className="space-y-2">
                {originBreeds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {originBreeds.map((b) => (
                      <span key={b} className="ui-accentPill">
                        {b}
                        <button
                          type="button"
                          onClick={() => setOriginBreeds((prev) => prev.filter((x) => x !== b))}
                          className="ml-2 font-bold"
                          aria-label={`Rimuovi ${b}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <BreedSearchInput
                  key={`origin-${originBreeds.length}`}
                  breeds={breedList.filter((bd) => bd.name !== 'Meticcio')}
                  value=""
                  onSelect={(bd) => setOriginBreeds((prev) => (prev.includes(bd.name) ? prev : [...prev, bd.name]))}
                  placeholder="Aggiungi una razza d'origine…"
                />
              </div>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Peso (facoltativo) */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Peso (kg)" hint="Facoltativo.">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="ui-control ui-input"
              placeholder="Es. 12.5"
            />
          </Field>
        </CardContent>
      </Card>

      {(allowManualSize || isOther) ? (
        <Card>
          <CardContent className="space-y-2">
            <Field
              label={isOther ? 'Taglia' : <>Taglia <span className="ui-required">*</span></>}
              hint={sizeFromBreedOnly ? 'Preimpostata dalla razza, modificabile solo dal gestionale.' : 'Facoltativa.'}
            >
              <select
                value={sizeCategory ?? ''}
                onChange={(e) => setSizeCategory((e.target.value as SizeCategory) || null)}
                className="ui-control ui-select"
              >
                <option value="">Seleziona taglia...</option>
                {SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Data di nascita (anno obbligatorio) */}
      <Card>
        <CardContent className="space-y-2">
          <Field label={<>Data di nascita <span className="ui-required">*</span></>} hint="Anno obbligatorio. Mese/Giorno facoltativi.">
            <div className="grid grid-cols-3 gap-2">
              <select value={birthD ?? ''} onChange={(e) => setBirthD(e.target.value ? Number(e.target.value) : null)} className="ui-control ui-select">
                <option value="">Giorno</option>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={birthM ?? ''}
                onChange={(e) => {
                  const nextMonth = e.target.value ? Number(e.target.value) : null;
                  setBirthM(nextMonth);
                  setBirthD((prevDay) => clampBirthDay(birthY, nextMonth, prevDay));
                }}
                className="ui-control ui-select"
              >
                <option value="">Mese</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={birthY ?? ''}
                onChange={(e) => {
                  const nextYear = e.target.value ? Number(e.target.value) : null;
                  setBirthY(nextYear);
                  setBirthD((prevDay) => clampBirthDay(nextYear, birthM, prevDay));
                }}
                className="ui-control ui-select"
              >
                <option value="">Anno *</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Sesso (optional) */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Sesso" hint="Facoltativo. Influenza le etichette del carattere.">
            <select value={sex ?? ''} onChange={(e) => setSex((e.target.value as DogSex) || null)} className="ui-control ui-select">
              <option value="">Non specificato</option>
              <option value="male">Maschio</option>
              <option value="female">Femmina</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      {/* Microchip (solo cani) */}
      {isDog ? (
        <Card>
          <CardContent className="space-y-2">
            <Field label="Microchip" hint="Obbligatorio per prenotare." id="dog-microchip" error={microchipWarning}>
              <input
                id="dog-microchip"
                type="text"
                inputMode="numeric"
                value={microchip}
                onChange={(e) => setMicrochip(e.target.value)}
                className="ui-control ui-input"
                placeholder="Es. 380260123456789"
                aria-invalid={!!microchipWarning}
                aria-describedby={microchipWarning ? 'dog-microchip-error' : undefined}
              />
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Colore mantello */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Colore mantello" hint="Facoltativo." id="dog-coat">
            <input id="dog-coat" type="text" value={coatColor} onChange={(e) => setCoatColor(e.target.value)} className="ui-control ui-input" placeholder="Es. nero / miele / fulvo…" />
          </Field>
        </CardContent>
      </Card>

      {/* Carattere */}
      {temperamentOptions.length > 0 ? (
        <Card>
          <CardContent className="space-y-2">
            <Field label="Carattere" hint="Facoltativo." id="dog-temperament">
              <div className="flex flex-wrap gap-2">
                {temperamentOptions.map((opt) => {
                  const active = temperament.includes(opt);
                  const label = genderedTemperamentLabel(opt, sex);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleTemperament(opt)}
                      className={['rounded-full px-4 py-2 ui-body ui-clickable', active ? 'ui-clickable--selected' : ''].join(' ')}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </CardContent>
        </Card>
      ) : null}

      {/* Note */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Note" hint="Facoltative." id="dog-notes">
            <textarea id="dog-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="ui-control ui-textarea" rows={4} placeholder="Es. Allergico al pollo…" />
          </Field>
        </CardContent>
      </Card>

      <div className="mt-6 pt-4 border-t border-[var(--border)]">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="submit" variant="primary" disabled={submitting || photoUploading} fullWidth>
            {submitting ? 'Salvataggio…' : 'Salva'}
          </Button>

          {onCancel ? (
            <Button type="button" variant="secondary" fullWidth onClick={onCancel}>
              Annulla
            </Button>
          ) : null}
        </div>
      </div>

      {isEdit && onDelete && (
        <Button type="button" variant="danger" fullWidth disabled={deleting} onClick={() => onDelete()}>
          {deleting ? 'Eliminazione…' : 'Elimina pet'}
        </Button>
      )}
    </form>
  );
}
