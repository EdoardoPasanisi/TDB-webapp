// FILE: app/services/pensione/page.tsx
import { Suspense } from 'react';
import PensioneClient from './PensioneClient';

export default function PensionePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)] text-[var(--text)]">
          <p className="text-sm text-[var(--muted)]">Caricamento...</p>
        </main>
      }
    >
      <PensioneClient />
    </Suspense>
  );
}
