'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Riporta la pagina all'inizio a ogni cambio di route. Necessario perché su
// mobile lo scroll non avviene sulla window (che Next resetterebbe da solo) ma
// dentro `.ui-appMain` (position: fixed; overflow-y: auto): quel container è
// persistente nel layout, quindi senza reset mantiene lo scrollTop della pagina
// precedente e le nuove pagine appaiono "già scrollate".
export function ScrollResetOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.ui-appMain');
    if (main) main.scrollTop = 0;

    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
