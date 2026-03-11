// FILE: app/signup/page.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se l'utente è già loggato, lo mandiamo al profilo
  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        router.push('/profile');
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const emailRedirectTo = `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (error || !data.user) {
      setError(error?.message ?? 'Errore nella registrazione.');
      setLoading(false);
      return;
    }

    // ✅ se per qualsiasi motivo arriva una sessione, la chiudiamo
    if (data.session) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    setLoading(false);
    router.push(`/signup/check-email?email=${encodeURIComponent(email)}`);

  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">Registrati</h1>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Creazione account...' : 'Crea account'}
          </button>
        </form>

        <p className="text-xs text-gray-700 text-center">
          Hai già un account?{' '}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-blue-600 hover:underline"
          >
            Accedi
          </button>
        </p>
        <div className="pt-2 border-t border-gray-100 text-center text-[11px] text-gray-600 space-x-3">
          <button type="button" onClick={() => router.push('/privacy')} className="hover:underline">
            Privacy
          </button>
          <button type="button" onClick={() => router.push('/terms')} className="hover:underline">
            Termini
          </button>
          <button type="button" onClick={() => router.push('/cookies')} className="hover:underline">
            Cookie
          </button>
        </div>
      </div>
    </main>
  );
}
