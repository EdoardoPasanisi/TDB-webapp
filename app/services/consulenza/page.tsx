'use client';

import Link from 'next/link';
import { ServicePurchasePage } from '@/components/services/ServicePurchasePage';
import { getConsulenzaProducts } from '@/lib/services/serviceCatalogApi';

export default function ConsulenzaPage() {
  return (
    <ServicePurchasePage
      title="Consulenza"
      description={
        <>
          Acquista crediti e poi prenota gli slot dalla pagina{' '}
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
      itemTitle="Consulenza"
      creditsLabel="Sessioni"
      loadProducts={getConsulenzaProducts}
      loadErrorMessage="Errore caricamento prodotti."
    />
  );
}
