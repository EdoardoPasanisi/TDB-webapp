'use client';

// Catalogo alloggi lato client. Parte dagli alloggi di serie (così i form mostrano
// subito prezzi plausibili) e li sostituisce con quelli del gestionale appena arrivano.
// Il prezzo vero lo ricalcola comunque il server al salvataggio.
//
// - scope 'public': solo alloggi attivi (form di prenotazione del cliente);
// - scope 'admin': anche quelli eliminati (servono per modificare prenotazioni vecchie).

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ACCOMMODATIONS, type AccommodationCatalog } from '../accommodations';

type Scope = 'public' | 'admin';

const URLS: Record<Scope, string> = {
  public: '/api/pensione/accommodations',
  admin: '/api/admin/accommodations',
};

const cache: Partial<Record<Scope, AccommodationCatalog>> = {};

async function fetchCatalog(scope: Scope): Promise<AccommodationCatalog> {
  const response = await fetch(URLS[scope], { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('Alloggi non disponibili.');
  const json = (await response.json()) as { items?: AccommodationCatalog };
  return json.items?.length ? json.items : DEFAULT_ACCOMMODATIONS;
}

export function useAccommodationCatalog(scope: Scope = 'public'): {
  catalog: AccommodationCatalog;
  loaded: boolean;
  reload: () => Promise<void>;
} {
  const [catalog, setCatalog] = useState<AccommodationCatalog>(() => cache[scope] ?? DEFAULT_ACCOMMODATIONS);
  const [loaded, setLoaded] = useState(() => Boolean(cache[scope]));

  const reload = useCallback(async () => {
    try {
      const next = await fetchCatalog(scope);
      cache[scope] = next;
      setCatalog(next);
    } catch {
      // Rete o tabella non disponibili: restano gli alloggi di serie.
    } finally {
      setLoaded(true);
    }
  }, [scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { catalog, loaded, reload };
}

/** Da chiamare dopo una modifica nel gestionale, così i form non usano il catalogo vecchio. */
export function invalidateAccommodationCatalogCache(): void {
  delete cache.public;
  delete cache.admin;
}
