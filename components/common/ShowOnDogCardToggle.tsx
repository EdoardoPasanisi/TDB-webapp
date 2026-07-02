// components/common/ShowOnDogCardToggle.tsx
'use client';

import type { ReactNode } from 'react';

interface ShowOnDogCardToggleProps {
  label: string;
  description?: string;
  children: ReactNode; // l'input vero e proprio (input, textarea, ecc.)
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}

/**
 * Componente riusabile per i campi che possono apparire sulla scheda pet pubblica.
 *
 * Esempio d'uso:
 *
 * <ShowOnDogCardToggle
 *   label="Telefono"
 *   description="Comparirà sulla scheda pubblica del pet."
 *   checked={showPhone}
 *   onCheckedChange={setShowPhone}
 * >
 *   <input ... />
 * </ShowOnDogCardToggle>
 */
export function ShowOnDogCardToggle({
  label,
  description,
  children,
  checked,
  onCheckedChange,
}: ShowOnDogCardToggleProps) {
  return (
    <div className="ui-toggleCard space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="ui-body font-[var(--font-weight-semibold)]">{label}</p>
          {description && (
            <p className="ui-note mt-0.5">
              {description}
            </p>
          )}
        </div>
        <label className="ui-checkboxLabel">
          <input
            type="checkbox"
            className="ui-checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
          />
          <span>Mostra su scheda pet</span>
        </label>
      </div>

      <div className="mt-1">{children}</div>
    </div>
  );
}
