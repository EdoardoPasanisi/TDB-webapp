'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export type ConfirmKeyword = 'ELIMINA' | 'MODIFICA';

type ConfirmOptions = {
  keyword: ConfirmKeyword;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Conferma esplicita per azioni sensibili del gestionale: l'operatore deve digitare
 * la parola chiave esatta ("ELIMINA" per le eliminazioni, "MODIFICA" per le modifiche)
 * prima di poter procedere. Evita cancellazioni/modifiche accidentali.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [value, setValue] = useState('');
  const resolverRef = useRef<((result: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOptions(next);
    setValue('');
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
    setValue('');
  }, []);

  useEffect(() => {
    if (!options) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settle(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options, settle]);

  const matched = options ? value.trim() === options.keyword : false;
  const isDelete = options?.keyword === 'ELIMINA';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
          <button type="button" aria-label="Annulla" className="ui-modalOverlay" onClick={() => settle(false)} />
          <div role="dialog" aria-modal="true" className="ui-modalPanel">
            <div className="ui-modalHeader">
              <div className="ui-modalTitle">{options.title}</div>
            </div>
            <div className="ui-modalBody ui-modalBody--mobile-safe space-y-4">
              <div className="ui-body">{options.message}</div>
              <div className="space-y-1">
                <label className="ui-label">
                  Digita <span className="font-[var(--font-weight-bold)]">{options.keyword}</span> per confermare
                </label>
                <input
                  autoFocus
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && matched) settle(true);
                  }}
                  className="ui-control ui-input"
                  placeholder={options.keyword}
                  aria-invalid={value.length > 0 && !matched}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" className="ui-btnCompact" onClick={() => settle(false)}>
                  Annulla
                </Button>
                <Button
                  variant={isDelete ? 'danger' : 'primary'}
                  className="ui-btnCompact"
                  disabled={!matched}
                  onClick={() => settle(true)}
                >
                  {options.confirmLabel ?? (isDelete ? 'Elimina' : 'Conferma')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm deve essere usato dentro <ConfirmProvider>.');
  }
  return confirm;
}
