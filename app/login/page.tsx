// FILE: app/login/page.tsx
import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="ui-page min-h-screen flex items-center justify-center">
          <p className="ui-muted">Caricamento…</p>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
