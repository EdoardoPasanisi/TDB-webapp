// FILE: components/dogs/DogAvatar.tsx
'use client';
/* eslint-disable @next/next/no-img-element */

import { useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  photoPath?: string | null;
  updatedAt?: string | null;
  alt: string;
  size?: number; // px
  className?: string;
};

function buildPublicUrl(photoPath: string, updatedAt?: string | null): string {
  const { data } = supabase.storage.from('dog-images').getPublicUrl(photoPath);
  const base = data.publicUrl;
  // cache buster: quando cambia foto, updated_at cambia
  const bust = updatedAt ? encodeURIComponent(updatedAt) : String(Date.now());
  return `${base}?v=${bust}`;
}

export function DogAvatar({ photoPath, updatedAt, alt, size = 40, className }: Props) {
  const photoUrl = useMemo(() => {
    if (!photoPath) return null;
    return buildPublicUrl(photoPath, updatedAt);
  }, [photoPath, updatedAt]);

  const dim = { width: size, height: size };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={alt}
        style={dim}
        className={
          className ??
          'rounded-full object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0'
        }
      />
    );
  }
  // Fallback immagine (icona neutra)
  return (
    <img
      src="/dog-solid-full.svg"
      alt={alt}
      style={dim}
      className={
        className ??
        'rounded-full object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0'
      }
    />
  );
}
