// FILE: pawny-webapp/app/forgot-password/page.tsx
'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // messaggio “neutro” (non leakiamo se l’email esiste)
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDoneMessage(null);
    setErrorMessage(null);
    setLoading(true);

    try {
      const redirectTo = origin ? `${origin}/reset-password` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      // Per UX/sicurezza: stesso messaggio sia che l’email esista sia che no.
      if (error) {
        // Mostriamo un messaggio umano ma non tecnico
        setDoneMessage(
          'Se l’indirizzo è registrato, riceverai un’email con le istruzioni per reimpostare la password.'
        );
      } else {
        setDoneMessage(
          'Se l’indirizzo è registrato, riceverai un’email con le istruzioni per reimpostare la password.'
        );
      }
    } catch {
      setErrorMessage('Qualcosa è andato storto. Riprova tra poco.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">Recupera password</h1>

        <p className="text-sm text-gray-700">
          Inserisci la tua email. Se è registrata, riceverai un link per impostare una nuova password.
        </p>

        {doneMessage && (
          <div className="rounded border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-800">{doneMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="rounded border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Invio in corso...' : 'Invia email di recupero'}
          </button>
        </form>

        <p className="text-xs text-gray-700 text-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-blue-600 hover:underline"
          >
            Torna al login
          </button>
        </p>
      </div>
    </main>
  );
}
