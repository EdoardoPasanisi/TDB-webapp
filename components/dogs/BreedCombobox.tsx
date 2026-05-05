'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DOG_BREEDS, getDogBreedSearchScore, type DogBreed } from '@/data/dogBreeds';

type Props = {
  value: string;
  onChange: (next: string, meta?: DogBreed) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function BreedCombobox({ value, onChange, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOG_BREEDS.slice(0, 50);

    return DOG_BREEDS
      .map((breed) => ({
        breed,
        score: getDogBreedSearchScore(breed, q),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.breed.name.localeCompare(right.breed.name, 'it', { sensitivity: 'base' })
      )
      .slice(0, 50)
      .map((item) => item.breed);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? query : value}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setQuery(value);
        }}
        onChange={(e) => {
          const next = e.target.value;
          if (!open) setOpen(true);
          setQuery(next);
          onChange(next);
        }}
        placeholder={placeholder ?? 'Cerca razza...'}
        disabled={disabled}
        className="ui-control ui-input"
        autoComplete="off"
      />

      {open && !disabled && (
        <div className="ui-comboboxMenu">
          {filtered.length === 0 ? (
            <div className="ui-comboboxEmpty">Nessun risultato.</div>
          ) : (
            <ul className="py-1">
              {filtered.map((b) => (
                <li key={`${b.size}-${b.name}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(b.name, b);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="ui-comboboxOption"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="ui-body font-[var(--font-weight-semibold)]">
                        <strong>{b.name}</strong>
                      </span>
                      <span className="ui-comboboxOptionMeta">
                        {b.size} • diff {b.washDifficulty}
                      </span>
                    </div>
                    {b.aliases.length > 0 ? (
                      <div className="ui-comboboxOptionSub italic">{b.aliases.join(', ')}</div>
                    ) : null}
                    <div className="ui-comboboxOptionSub">{b.coat}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
