// FILE: components/ui/Button.tsx
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

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
  const base = 'ui-btn';

  const variants: Record<ButtonVariant, string> = {
    primary: 'ui-btnTone-primary',
    secondary: 'ui-btnTone-secondary',
    ghost: 'ui-btnTone-ghost',
    danger: 'ui-btnTone-danger',
  };

  return (
    <button
      className={cx(base, variants[variant], fullWidth && 'w-full', className)}
      {...props}
    />
  );
}
