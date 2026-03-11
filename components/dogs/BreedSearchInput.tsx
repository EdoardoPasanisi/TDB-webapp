'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DogBreed } from '@/data/dogBreeds';

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
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder={placeholder}
          autoComplete="off"
        />

        {onClear && (value || query) ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              onClear();
            }}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            aria-label="Svuota razza"
          >
            ✕
          </button>
        ) : null}
      </div>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-72 overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-600">
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <div className="font-medium text-gray-900">{b.name}</div>
                    {b.aliases && b.aliases.length > 0 ? (
                      <div className="text-xs text-gray-500 truncate">{b.aliases.join(', ')}</div>
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
        <p className="mt-1 text-[11px] text-gray-500">
          Selezionata: <span className="font-medium">{value}</span>
        </p>
      ) : null}
    </div>
  );
}
