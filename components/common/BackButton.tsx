// components/common/BackButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type Props = {
  hrefFallback?: string;
  label?: string;
  className?: string;

  // ✅ default: su mobile lo gestisce la TopBar
  showOnMobile?: boolean;
};

export function BackButton({
  hrefFallback = '/services',
  label = '← Indietro',
  className,
  showOnMobile = false,
}: Props) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="secondary"
      className={[
        showOnMobile ? '' : 'hidden md:inline-flex',
        className ?? '',
      ].join(' ')}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(hrefFallback);
      }}
    >
      {label}
    </Button>
  );
}