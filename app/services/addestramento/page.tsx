'use client';

import Link from 'next/link';
import { ServicePurchasePage } from '@/components/services/ServicePurchasePage';
import { getAddestramentoProducts } from '@/lib/services/serviceCatalogApi';

export default function AddestramentoPage() {
  return (
    <ServicePurchasePage
      title="Addestramento"
      description={
        <>
          Acquista pacchetti e poi prenota gli slot dalla pagina{' '}
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
      itemTitle="Addestramento"
      creditsLabel="Lezioni"
      loadProducts={getAddestramentoProducts}
      loadErrorMessage="Errore caricamento prodotti."
    />
  );
}
