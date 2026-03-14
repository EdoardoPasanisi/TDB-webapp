// components/services/booking/BookingDetailHeader.tsx
'use client';

type Props = {
  title: string;
  subtitle?: string;
};

export function BookingDetailHeader({ title, subtitle }: Props) {
  return (
    <header className="space-y-1">
      <h1 className="ui-title">{title}</h1>
      {subtitle ? <p className="ui-muted">{subtitle}</p> : null}
    </header>
  );
}
