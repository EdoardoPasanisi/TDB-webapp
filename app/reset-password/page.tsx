// FILE: pawny-webapp/app/reset-password/page.tsx
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // Se detectSessionInUrl è true, Supabase può stabilire la sessione dal link di recovery
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setChecking(false);
    };
    run();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDoneMessage(null);

    if (password.length < 8) {
      setErrorMessage('La password deve contenere almeno 8 caratteri.');
      return;
    }
    if (password !== confirm) {
      setErrorMessage('Le due password non coincidono.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage('Non siamo riusciti ad aggiornare la password. Riprova.');
        return;
      }

      setDoneMessage('✅ Password aggiornata. Verrai reindirizzato al login...');
      // opzionale ma pulito: chiudiamo la sessione di recovery e torniamo al login
      await supabase.auth.signOut();
      setTimeout(() => {
        router.replace('/login?reset=1');
      }, 700);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full">
          <p className="text-sm text-gray-700">Verifica link in corso...</p>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full space-y-3">
          <h1 className="text-xl font-bold">Link non valido o scaduto</h1>
          <p className="text-sm text-gray-700">
            Il link di recupero non è valido oppure è scaduto. Richiedine uno nuovo.
          </p>

          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Richiedi nuovo link
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full px-4 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            Torna al login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">Imposta nuova password</h1>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nuova password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conferma password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Salvataggio...' : 'Aggiorna password'}
          </button>
        </form>
      </div>
    </main>
  );
}
