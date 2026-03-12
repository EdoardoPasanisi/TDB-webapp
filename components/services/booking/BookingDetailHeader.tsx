// components/services/booking/BookingDetailHeader.tsx
'use client';

type Props = {
  title: string;
  subtitle?: string;
};

export function BookingDetailHeader({ title, subtitle }: Props) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle ? <p className="text-sm text-gray-700">{subtitle}</p> : null}
    </header>
  );
}
