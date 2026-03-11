// FILE: pawny-webapp/app/account/password/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDoneMessage(null);

    if (!currentPassword.trim()) {
      setErrorMessage('Inserisci la password attuale.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (password !== confirm) {
      setErrorMessage('Le due password non coincidono.');
      return;
    }

    setLoading(true);
    try {
      // 1) serve una sessione valida
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErrorMessage('Sessione scaduta. Effettua di nuovo il login.');
        return;
      }

      // 2) recupero email dell’utente loggato
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setErrorMessage('Sessione non valida. Effettua di nuovo il login.');
        return;
      }

      const email = userData.user.email;
      if (!email) {
        setErrorMessage('Email utente non disponibile. Effettua di nuovo il login.');
        return;
      }

      // 3) verifica password attuale (reauth)
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauthError) {
        setErrorMessage('Password attuale non corretta.');
        return;
      }

      // 4) aggiorna password
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage('Non siamo riusciti ad aggiornare la password. Riprova.');
        return;
      }

      setDoneMessage('✅ Password aggiornata correttamente.');
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Cambia password</h1>
          <button
            type="button"
            onClick={() => router.push('/account')}
            className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Indietro
          </button>
        </header>

        <section className="bg-white rounded-lg shadow p-4 space-y-3">
          <p className="text-sm text-gray-700">
            Inserisci la password attuale e poi la nuova password (minimo 8 caratteri).
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Password attuale</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nuova password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 rounded bg-black text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Salvataggio...' : 'Aggiorna password'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
