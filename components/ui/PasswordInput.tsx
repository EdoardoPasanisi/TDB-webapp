'use client';

import { useState, type InputHTMLAttributes } from 'react';

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M3 3l18 18" strokeLinecap="round" /> : null}
    </svg>
  );
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Campo password con toggle "occhio" per mostrarne/nasconderne il contenuto. */
export function PasswordInput({ className, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={`${className ?? 'ui-control ui-input'} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
        aria-label={visible ? 'Nascondi password' : 'Mostra password'}
        aria-pressed={visible}
        tabIndex={-1}
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}
