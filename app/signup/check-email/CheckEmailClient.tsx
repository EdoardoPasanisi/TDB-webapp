'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getAuthRedirectBase } from '@/lib/auth/getAuthRedirectBase';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function CheckEmailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = useMemo(() => (searchParams.get('email') ?? '').trim(), [searchParams]);

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
    const redirectBase = getAuthRedirectBase();
    const confirmNext = encodeURIComponent('/login?verified=1');
    const emailRedirectTo = redirectBase ? `${redirectBase}/auth/callback?next=${confirmNext}` : undefined;
    const { error: resendError } = emailRedirectTo
      ? await supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo },
        })
      : await supabase.auth.resend({
          type: 'signup',
          email,
        });
    setSending(false);

    if (resendError) {
      setError('Non sono riuscito a reinviare l’email. Riprova tra poco o controlla spam/promozioni.');
      return;
    }

    setInfo('Email di conferma reinviata.');
  };

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-8 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h1 className="ui-title">Controlla la tua email</h1>
              <p className="ui-body">
                Ti abbiamo inviato un link di conferma{email ? ` a ${email}` : ''}. Aprilo per completare la
                registrazione.
              </p>
              <p className="ui-muted">Se non trovi la mail, controlla anche Spam o Promozioni.</p>
            </div>

            {error ? <div className="ui-error">{error}</div> : null}

            {info ? (
              <div className="ui-alertWarn">
                {info}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2">
              <Button type="button" variant="primary" fullWidth onClick={() => router.push('/login')}>
                Vai al login
              </Button>

              <Button type="button" variant="secondary" fullWidth disabled={!email || sending} onClick={handleResend}>
                {sending ? 'Invio…' : 'Reinvia email'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
