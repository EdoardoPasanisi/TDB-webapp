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
 * Componente riusabile per i campi che possono apparire sulla scheda cane pubblica.
 *
 * Esempio d'uso:
 *
 * <ShowOnDogCardToggle
 *   label="Telefono"
 *   description="Comparirà sulla scheda pubblica del cane."
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
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-800">{label}</p>
          {description && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              {description}
            </p>
          )}
        </div>
        <label className="flex items-center gap-1 text-[11px] text-gray-700 select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
          />
          <span>Mostra su scheda cane</span>
        </label>
      </div>

      <div className="mt-1">{children}</div>
    </div>
  );
}
