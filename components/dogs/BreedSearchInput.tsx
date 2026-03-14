'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DogBreed } from '@/data/dogBreeds';
import { Button } from '@/components/ui/Button';

type Props = {
  breeds: DogBreed[];
  value: string;
  onSelect: (breed: DogBreed) => void;
  onClear?: () => void;
  placeholder?: string;
};

/**
 * Input di ricerca razza:
 * - cerca su name + aliases
 * - mostra label: "Nome (Alias1, Alias2)"
 * - salva SOLO il name (gestito da onSelect nel parent)
 */
export function BreedSearchInput({
  breeds,
  value,
  onSelect,
  onClear,
  placeholder = 'Cerca razza…',
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Chiudi dropdown se click fuori
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      const target = e.target as Node;
      if (!containerRef.current.contains(target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  const filtered = useMemo(() => {
    if (!normalizedQuery) return breeds.slice(0, 20);

    const results = breeds.filter((b) => {
      const nameMatch = b.name.toLowerCase().includes(normalizedQuery);
      if (nameMatch) return true;

      // ✅ alias match
      return (b.aliases ?? []).some((a) => a.toLowerCase().includes(normalizedQuery));
    });

    return results.slice(0, 30);
  }, [breeds, normalizedQuery]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <input
          value={open ? query : (value ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery(value ?? '');
            setOpen(true);
          }}
          className="ui-control ui-input"
          placeholder={placeholder}
          autoComplete="off"
        />

        {onClear && (value || query) ? (
          <Button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              onClear();
            }}
            variant="secondary"
            className="h-[var(--control-h)] min-w-[48px] px-4"
            aria-label="Svuota razza"
          >
            ✕
          </Button>
        ) : null}
      </div>

      {open && (
        <div className="ui-comboboxMenu mt-2 max-h-72">
          {filtered.length === 0 ? (
            <div className="ui-comboboxEmpty">
              Nessuna razza trovata. Prova con un nome alternativo (es. “German Shepherd”).
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map((b) => (
                <li key={b.name}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(b); // il parent salva b.name
                      setQuery(b.name); // ✅ mostra solo nome principale nel campo
                      setOpen(false);
                    }}
                    className="ui-comboboxOption"
                  >
                    <div className="ui-body font-[var(--font-weight-semibold)]">{b.name}</div>
                    {b.aliases && b.aliases.length > 0 ? (
                      <div className="ui-muted truncate">{b.aliases.join(', ')}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Helper: se value è impostato ma query è diversa, evitiamo confusione */}
      {value && query && value !== query ? (
        <p className="mt-2 ui-muted">
          Selezionata: <span className="font-[var(--font-weight-semibold)]">{value}</span>
        </p>
      ) : null}
    </div>
  );
}
