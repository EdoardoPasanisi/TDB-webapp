'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DOG_BREEDS, type DogBreed } from '@/data/dogBreeds';

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
    return DOG_BREEDS.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 50);
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
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        autoComplete="off"
      />

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-600">Nessun risultato.</div>
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{b.name}</span>
                      <span className="text-xs text-gray-600">
                        {b.size} • diff {b.washDifficulty}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{b.coat}</div>
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
