'use client';
/* eslint-disable @next/next/no-img-element */

import { useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ProfileAvatarProps = {
  photoPath?: string | null;
  alt: string;
  initials?: string;
  size?: number;
  className?: string;
  fallbackClassName?: string;
  textClassName?: string;
};

function buildPublicUrl(photoPath: string): string {
  const { data } = supabase.storage.from('profile-images').getPublicUrl(photoPath);
  return data.publicUrl;
}

export function ProfileAvatar({
  photoPath,
  alt,
  initials = '?',
  size = 48,
  className,
  fallbackClassName,
  textClassName,
}: ProfileAvatarProps) {
  const photoUrl = useMemo(() => {
    if (!photoPath) return null;
    return buildPublicUrl(photoPath);
  }, [photoPath]);

  const dim = { width: size, height: size };
  const imageClassName =
    className ?? 'ui-mediaFrame ui-mediaFrame--circle overflow-hidden object-cover shrink-0';
  const fallbackFrameClassName =
    fallbackClassName ??
    'ui-mediaFrame ui-mediaFrame--circle flex shrink-0 items-center justify-center overflow-hidden bg-[rgba(255,130,0,0.14)] text-[18px] font-[var(--font-weight-bold)] text-[var(--text)]';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={alt}
        style={dim}
        className={imageClassName}
      />
    );
  }

  return (
    <div style={dim} className={fallbackFrameClassName} aria-label={alt}>
      <span className={textClassName}>{initials}</span>
    </div>
  );
}
