// FILE: app/signup/check-email/page.tsx
import { Suspense } from 'react';
import CheckEmailClient from './CheckEmailClient';

export default function SignupCheckEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full space-y-3">
            <p className="text-sm text-gray-700 text-center">Caricamento…</p>
          </div>
        </main>
      }
    >
      <CheckEmailClient />
    </Suspense>
  );
}
