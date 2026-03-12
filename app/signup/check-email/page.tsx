// FILE: app/signup/check-email/page.tsx
import { Suspense } from 'react';
import CheckEmailClient from './CheckEmailClient';

export default function SignupCheckEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)] p-4">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 max-w-md w-full">
            <p className="ui-body text-center text-[var(--muted)]">Caricamento…</p>
          </div>
        </main>
      }
    >
      <CheckEmailClient />
    </Suspense>
  );
}
