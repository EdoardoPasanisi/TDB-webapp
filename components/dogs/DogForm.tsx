// components/dogs/DogForm.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { DOG_BREEDS, type GroomingDifficulty, type SizeCategory } from '@/data/dogBreeds';
import { BreedSearchInput } from '@/components/dogs/BreedSearchInput';
import type { Dog, DogInput, DogSex } from '@/types/dog';
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

// ✅ Carattere: manteniamo chiavi canoniche (maschile) e rendiamo la label "gender-aware" solo in UI
export const TEMPERAMENT_OPTIONS = {
  socialita: ['Socievole', 'Riservato', 'Timido', 'Diffidente con estranei', 'Affettuoso', 'Indipendente'],
  comportamento: ['Tranquillo', 'Calmo', 'Vivace', 'Energico', 'Giocherellone', 'Curioso'],
  carattere: ['Obbediente', 'Testardo', 'Sensibile', 'Sicuro di sé', 'Ansioso'],
  convivenza: ['Buono con altri cani', 'Buono con le persone', 'Buono con i bambini', 'Territoriale', 'Protettivo'],
} as const;

export type TemperamentOption = typeof TEMPERAMENT_OPTIONS[keyof typeof TEMPERAMENT_OPTIONS][number];

export const TEMPERAMENT_FLAT_LIST: TemperamentOption[] = Object.values(TEMPERAMENT_OPTIONS).flat();

function genderedTemperamentLabel(option: string, sex: DogSex | null): string {
  if (sex !== 'female') return option;

  if (option.startsWith('Buono ')) return option.replace(/^Buono\b/, 'Buona');
  if (option.startsWith('Sicuro ')) return option.replace(/^Sicuro\b/, 'Sicura');
  if (option === 'Giocherellone') return option.replace(/^Giocherellone\b/, 'Giocherellona');

  const parts = option.split(' ');
  const last = parts[parts.length - 1];
  if (last.endsWith('o')) {
    const lastFem = last.slice(0, -1) + 'a';
    return [...parts.slice(0, -1), lastFem].join(' ');
  }

  return option;
}

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

  if (!m || !d) {
    // anno-only
    return `${y}-01-01`;
  }

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

  // ✅ NEW (soft start): foto cane
  initialPhotoUrl?: string | null;
  onPhotoSelected?: (file: File | null) => void;
  photoUploading?: boolean;
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
}: DogFormProps) {
  const isEdit = mode === 'edit';
  const editableDog = isEdit ? initialDog ?? null : null;
  const initialBirthParts = parseBirthDate(editableDog?.birth_date ?? null);

  // Required
  const [name, setName] = useState(editableDog?.name ?? '');
  const [breed, setBreed] = useState(editableDog?.breed ?? '');
  const [sizeCategory, setSizeCategory] = useState<SizeCategory | null>(editableDog?.size_category ?? null);

  // Business-only (non mostrato)
  const [groomingDifficulty, setGroomingDifficulty] = useState<GroomingDifficulty | null>(
    editableDog?.grooming_difficulty ?? null,
  );

  // New: sex (optional)
  const [sex, setSex] = useState<DogSex | null>(editableDog?.sex ?? null);

  // Optional
  const [microchip, setMicrochip] = useState(editableDog?.microchip ?? '');
  const [microchipWarning, setMicrochipWarning] = useState<string | null>(null);
  const [notes, setNotes] = useState(editableDog?.notes ?? '');

  const [coatColor, setCoatColor] = useState(editableDog?.coat_color ?? '');
  const [temperament, setTemperament] = useState<TemperamentOption[]>(
    (editableDog?.temperament ?? []) as TemperamentOption[],
  );

  // Birth date parts (2000–2026)
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

  const [formError, setFormError] = useState<string | null>(null);

  // ✅ NEW: preview locale della foto selezionata
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

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

  function toggleTemperament(option: TemperamentOption) {
    setTemperament((prev) => {
      if (prev.includes(option)) return prev.filter((x) => x !== option);
      return [...prev, option];
    });
  }

  function validateRequired(): string[] {
    const errors: string[] = [];
    if (!name.trim()) errors.push('Inserisci il nome del cane.');
    if (!breed.trim()) errors.push('Seleziona la razza.');
    if (!sizeCategory) errors.push('Seleziona la taglia.');
    // ✅ anno obbligatorio
    if (!birthY) errors.push('Seleziona l’anno di nascita.');
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const errors = validateRequired();
    if (errors.length > 0) {
      const msg = errors.join('\n');
      setFormError(errors.join(' '));
      window.alert(msg);
      return;
    }

    const microchipDigitsOnly = sanitizeMicrochip(microchip).replace(/\D/g, '');
    const microchipIsProvided = microchipDigitsOnly.length > 0;
    const microchipIsValid = !microchipIsProvided ? true : isValidMicrochip(microchipDigitsOnly);

    if (microchipIsProvided && !microchipIsValid) {
      setMicrochipWarning(
        'Il numero di microchip non sembra corretto: deve essere composto da 15 cifre. Il valore non verrà salvato.'
      );
    }

    const microchipToSave = !microchipIsProvided
      ? null
      : microchipIsValid
      ? microchipDigitsOnly
      : mode === 'edit'
      ? initialDog?.microchip ?? null
      : null;

    const normalizedBirthDay = clampBirthDay(birthY, birthM, birthD);
    const birth_date = buildBirthDate(birthY, birthM, normalizedBirthDay);

    const payload: DogInput = {
      name: name.trim(),
      breed: breed.trim() || null,

      size_category: sizeCategory,
      grooming_difficulty: groomingDifficulty ?? null,

      sex: sex,

      microchip: microchipToSave,
      birth_date,
      notes: notes.trim() ? notes.trim() : null,

      coat_color: coatColor.trim() ? coatColor.trim() : null,
      temperament: temperament.length > 0 ? temperament : null,

      // le preferenze della scheda pubblica si gestiscono da "Personalizza scheda"
      show_breed: showBreed,
      show_sex: showSex,
      show_size: showSize,
      show_microchip: showMicrochip,
      show_birth_date: showBirthDate,
      show_notes: showNotes,

      show_coat_color: showCoatColor,
      show_temperament: showTemperament,
    };

    await onSubmit(payload);

    if (microchipIsProvided && !microchipIsValid) {
      window.alert(
        'Attenzione: il numero di microchip inserito non è nel formato corretto. Non lo abbiamo salvato.'
      );
    }
  }

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 2000; y <= 2026; y += 1) years.push(y);
    return years;
  }, []);

  const maxDay = useMemo(() => {
    if (!birthY || !birthM) return 31;
    return daysInMonth(birthY, birthM);
  }, [birthY, birthM]);

  const effectivePhotoUrl = photoPreviewUrl ?? initialPhotoUrl ?? null;

  // ✅ flags per UI foto (necessari se usi i testi "Carica/Cambia" ecc.)
  const hasSavedPhoto = Boolean(initialPhotoUrl);
  const hasLocalSelection = Boolean(photoPreviewUrl);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg p-3 text-sm">
          {formError}
        </div>
      )}

      {/* ✅ Foto cane */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-800">Foto</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Facoltativa. JPG/PNG/WebP.</p>
          </div>
          {photoUploading && <span className="text-[11px] text-gray-500">Caricamento…</span>}
        </div>

        <div className="flex items-start gap-3">
          <label
            className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200 cursor-pointer relative"
            title="Carica o cambia foto"
          >
            {effectivePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={effectivePhotoUrl} alt="Foto cane" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] text-gray-500">Nessuna</span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={photoUploading}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;

                if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                const nextPreview = f ? URL.createObjectURL(f) : null;
                setPhotoPreviewUrl(nextPreview);

                onPhotoSelected?.(f);
              }}
              className="sr-only"
            />
          </label>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex">
                <span className="px-3 py-2 rounded border border-gray-300 text-xs font-medium hover:bg-gray-50 cursor-pointer">
                  {hasSavedPhoto ? 'Cambia foto' : 'Carica foto'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={photoUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;

                    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                    const nextPreview = f ? URL.createObjectURL(f) : null;
                    setPhotoPreviewUrl(nextPreview);

                    onPhotoSelected?.(f);
                  }}
                  className="sr-only"
                />
              </label>

              {hasLocalSelection && (
                <button
                  type="button"
                  className="px-3 py-2 rounded border border-gray-300 text-xs font-medium hover:bg-gray-50"
                  disabled={photoUploading}
                  onClick={() => {
                    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                    setPhotoPreviewUrl(null);
                    onPhotoSelected?.(null);
                  }}
                >
                  Annulla selezione
                </button>
              )}

              {hasSavedPhoto && !hasLocalSelection && onPhotoRemove && (
                <button
                  type="button"
                  className="px-3 py-2 rounded border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50"
                  disabled={photoUploading}
                  onClick={async () => {
                    const ok = window.confirm('Vuoi rimuovere la foto del cane?');
                    if (!ok) return;
                    await onPhotoRemove();
                  }}
                >
                  Rimuovi foto
                </button>
              )}
            </div>

            <p className="text-[11px] text-gray-500">
              Clicca sull’anteprima oppure sul pulsante per selezionare un’immagine.
            </p>
          </div>
        </div>
      </div>


      {/* Nome (required) */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Nome" required id="dog-name">
            <input
              id="dog-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Es. Luna"
              aria-invalid={!name.trim()}
            />
          </Field>
        </CardContent>
      </Card>      

      {/* Razza (required) */}
      <Card>
        <CardContent className="space-y-2">
          <Field
            label="Razza"
            required
            hint="Cerca anche per nomi alternativi."
            id="dog-breed"
          >
            {/* Nota: BreedSearchInput non supporta id/aria nativamente, va bene così */}
            <BreedSearchInput
              breeds={DOG_BREEDS}
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

      {/* Taglia (required) */}
      <Card>
        <CardContent className="space-y-2">
          <Field
            label={
              <>
                Taglia <span className="text-red-500">*</span>
              </>
            }
            hint="Preimpostata dalla razza, modificabile."
          >
            <select
              value={sizeCategory ?? ''}
              onChange={(e) => setSizeCategory((e.target.value as SizeCategory) || null)}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Seleziona taglia...
              </option>
              {SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      {/* Data di nascita (anno obbligatorio) */}
      <Card>
        <CardContent className="space-y-2">
          <Field
            label={
              <>
                Data di nascita <span className="text-red-500">*</span>
              </>
            }
            hint="Anno obbligatorio. Mese/Giorno facoltativi."
          >
            <div className="grid grid-cols-3 gap-2">
              <select
                value={birthD ?? ''}
                onChange={(e) => setBirthD(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Giorno</option>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={birthM ?? ''}
                onChange={(e) => {
                  const nextMonth = e.target.value ? Number(e.target.value) : null;
                  setBirthM(nextMonth);
                  setBirthD((prevDay) => clampBirthDay(birthY, nextMonth, prevDay));
                }}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Mese</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={birthY ?? ''}
                onChange={(e) => {
                  const nextYear = e.target.value ? Number(e.target.value) : null;
                  setBirthY(nextYear);
                  setBirthD((prevDay) => clampBirthDay(nextYear, birthM, prevDay));
                }}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Anno *</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Sesso (optional) */}
      <Card>
        <CardContent className="space-y-2">
          <Field
            label="Sesso"
            hint="Facoltativo. Influenza le etichette del carattere."
          >
            <select
              value={sex ?? ''}
              onChange={(e) => setSex((e.target.value as DogSex) || null)}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 py-2 text-sm"
            >
              <option value="">Non specificato</option>
              <option value="male">Maschio</option>
              <option value="female">Femmina</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      {/* Microchip (optional) */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Microchip" hint="Facoltativo." id="dog-microchip" error={microchipWarning}>
            <input
              id="dog-microchip"
              type="text"
              inputMode="numeric"
              value={microchip}
              onChange={(e) => setMicrochip(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Es. 380260123456789"
              aria-invalid={!!microchipWarning}
              aria-describedby={microchipWarning ? 'dog-microchip-error' : undefined}
            />
          </Field>
        </CardContent>
      </Card> 

      {/* Colore mantello */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Colore mantello" hint="Facoltativo." id="dog-coat">
            <input
              id="dog-coat"
              type="text"
              value={coatColor}
              onChange={(e) => setCoatColor(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Es. nero / miele / fulvo…"
            />
          </Field>
        </CardContent>
      </Card>       

      {/* Carattere */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Carattere" hint="Facoltativo." id="dog-temperament">
            <div className="flex flex-wrap gap-2">
              {TEMPERAMENT_FLAT_LIST.map((opt) => {
                const active = temperament.includes(opt);
                const label = genderedTemperamentLabel(opt, sex);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleTemperament(opt)}
                    className={[
                      'px-3 py-1.5 rounded-full text-sm border',
                      active ? 'bg-black text-white border-black' : 'bg-white text-gray-800 border-gray-300',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        </CardContent>
      </Card>  

      {/* Note */}
      <Card>
        <CardContent className="space-y-2">
          <Field label="Note" hint="Facoltative." id="dog-notes">
            <textarea
              id="dog-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              rows={4}
              placeholder="Es. Allergico al pollo…"
            />
          </Field>
        </CardContent>
      </Card> 

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-[var(--border)] bg-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={submitting || photoUploading}
            className="flex-1"
          >
            {submitting ? 'Salvataggio…' : 'Salva'}
          </Button>

          {onCancel ? (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Annulla
            </Button>
          ) : null}
        </div>
      </div>

      {isEdit && onDelete && (
        <button
          type="button"
          disabled={deleting}
          onClick={() => onDelete()}
          className="w-full rounded border border-red-500 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Eliminazione…' : 'Elimina cane'}
        </button>
      )}
    </form>
  );
}
