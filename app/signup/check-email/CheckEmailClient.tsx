// FILE: app/signup/check-email/CheckEmailClient.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function CheckEmailClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const email = useMemo(() => (sp.get('email') ?? '').trim(), [sp]);

  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setInfo(null);
    setError(null);

    if (!email) {
      setError('Email mancante: torna indietro e ripeti la registrazione.');
      return;
    }

    setSending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    setSending(false);

    if (error) {
      setError(
        'Non sono riuscito a reinviare l’email. Riprova tra poco oppure controlla spam/promozioni.'
      );
      return;
    }

    setInfo('Email di conferma reinviata ✅');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full space-y-3">
        <h1 className="text-xl font-bold text-center">Controlla la tua email</h1>

        <p className="text-sm text-gray-700 text-center">
          Ti abbiamo inviato un link di conferma{email ? ` a ${email}` : ''}.
          <br />
          Aprilo per completare la registrazione.
        </p>

        <p className="text-xs text-gray-500 text-center">
          Se non trovi la mail, controlla anche Spam/Promozioni.
        </p>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700 text-center">{error}</p>
          </div>
        )}

        {info && (
          <div className="rounded border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-800 text-center">{info}</p>
          </div>
        )}

        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="px-4 py-2 rounded bg-black text-white text-sm font-medium hover:opacity-90"
          >
            Vai al login
          </button>

          <button
            type="button"
            disabled={!email || sending}
            onClick={handleResend}
            className="px-4 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            {sending ? 'Invio…' : 'Reinvia email'}
          </button>
        </div>
      </div>
    </main>
  );
}
