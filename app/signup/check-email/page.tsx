// FILE: app/signup/check-email/page.tsx
import { Suspense } from 'react';
import CheckEmailClient from './CheckEmailClient';

export default function SignupCheckEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="ui-page min-h-screen flex items-center justify-center p-4">
          <div className="ui-panel p-6 max-w-md w-full">
            <p className="ui-muted text-center">Caricamento…</p>
          </div>
        </main>
      }
    >
      <CheckEmailClient />
    </Suspense>
  );
}
