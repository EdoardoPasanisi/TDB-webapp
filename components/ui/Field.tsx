// components/ui/Field.tsx
'use client';

import type { ReactNode } from 'react';

type FieldProps = {
  label: ReactNode;
  required?: boolean;
  hint?: string | null;
  error?: string | null;
  id?: string;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  required = false,
  hint = null,
  error = null,
  id,
  className = '',
  children,
}: FieldProps) {
  const hintId = id ? `${id}-hint` : undefined;
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className={className}>
      {/* ✅ label più grande e leggibile (usa i token global) */}
      <label
        htmlFor={id}
        className="ui-label"
      >
        {label} {required ? <span className="ui-required">*</span> : null}
      </label>

      <div className="mt-2">{children}</div>

      {hint ? (
        // ✅ supporto newline: "\n" va a capo
        <p id={hintId} className="mt-2 ui-muted whitespace-pre-line">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-2 ui-fieldError">
          {error}
        </p>
      ) : null}
    </div>
  );
}
