// FILE: app/services/pensione/page.tsx
import { Suspense } from 'react';
import PensioneClient from './PensioneClient';

export default function PensionePage() {
  return (
    <Suspense
      fallback={
        <main className="ui-page min-h-screen flex items-center justify-center">
          <p className="ui-muted">Caricamento...</p>
        </main>
      }
    >
      <PensioneClient />
    </Suspense>
  );
}
