'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import {
  GroupedServicePurchasePage,
  type GroupedPurchaseSection,
} from '@/components/services/GroupedServicePurchasePage';
import { getAsiloProducts } from '@/lib/services/serviceCatalogApi';

export default function AsiloPage() {
  const loadSections = useCallback(async (): Promise<GroupedPurchaseSection[]> => {
    const [halfProducts, fullProducts] = await Promise.all([
      getAsiloProducts('HALF'),
      getAsiloProducts('FULL'),
    ]);

    return [
      {
        key: 'HALF',
        label: 'Mezza giornata',
        itemTitle: 'Asilo — Mezza giornata',
        emptyMessage: 'Nessun prodotto per mezza giornata.',
        products: halfProducts,
      },
      {
        key: 'FULL',
        label: 'Giornata intera',
        itemTitle: 'Asilo — Giornata intera',
        emptyMessage: 'Nessun prodotto per giornata intera.',
        products: fullProducts,
      },
    ];
  }, []);

  return (
    <GroupedServicePurchasePage
      title="Asilo"
      description={
        <>
          Qui acquisti ingressi (crediti). La prenotazione delle giornate si fa dalla pagina{' '}
          <Link className="underline" href="/services">
            Servizi
          </Link>{' '}
          tramite <span className="font-semibold text-[var(--text)]">“Fissa data”</span>.
        </>
      }
      postPurchaseMessage={
        <>
          Acquisto completato! Ora vai su{' '}
          <Link className="underline" href="/services">
            Servizi
          </Link>{' '}
          e clicca <span className="font-semibold">“Fissa data”</span> per prenotare.
        </>
      }
      loadSections={loadSections}
      loadErrorMessage="Errore caricamento prodotti asilo."
    />
  );
}
