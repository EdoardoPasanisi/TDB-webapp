// FILE: components/ui/Button.tsx
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  variant = 'secondary',
  fullWidth,
  className,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 ' +
    'rounded-[var(--btn-radius)] ' +
    'h-[var(--btn-h)] px-[var(--btn-px)] ' +
    'text-[length:var(--btn-font-size)] font-[var(--btn-font-weight)] ' +
    'leading-none ' +
    'transition active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none ' +
    '[-webkit-tap-highlight-color:transparent]';

  // ✅ hover SOLO desktop (md+). Su mobile resta solo active.
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-[var(--brand-accent)] text-black shadow-[var(--shadow)] md:hover:opacity-90',
    secondary:
      'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] md:hover:bg-[var(--surface-2)]',
    ghost:
      'bg-transparent text-[var(--text)] md:hover:bg-[rgba(255,255,255,0.06)]',
  };

  return (
    <button
      className={cx(base, variants[variant], fullWidth && 'w-full', className)}
      {...props}
    />
  );
}