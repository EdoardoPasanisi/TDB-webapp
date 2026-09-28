import type { ReactNode } from 'react';

/**
 * Messaggio d'errore di un form. Va messo SUBITO SOPRA il pulsante di conferma/salva,
 * dove l'utente sta guardando quando lo preme (non in cima alla pagina, dove non si
 * vede). role="alert" lo fa leggere anche agli screen reader.
 */
export function FormError({ message, className }: { message: ReactNode | null | undefined; className?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className={className ? `ui-error ${className}` : 'ui-error'}>
      {message}
    </div>
  );
}
