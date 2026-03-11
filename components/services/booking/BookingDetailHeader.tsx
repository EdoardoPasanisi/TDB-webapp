// components/services/booking/BookingDetailHeader.tsx
'use client';

import { BackButton } from '@/components/common/BackButton';

type Props = {
  title: string;
  subtitle?: string;
};

export function BookingDetailHeader({ title, subtitle }: Props) {
  return (
    <header className="space-y-2">
      <BackButton hrefFallback="/services" label="← Torna ai servizi" />

      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="text-sm text-gray-700">{subtitle}</p> : null}
      </div>
    </header>
  );
}
