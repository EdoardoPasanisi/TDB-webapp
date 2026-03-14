'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Errore inaspettato.';
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectedFrom = useMemo(() => searchParams.get('redirectedFrom'), [searchParams]);
  const justVerified = useMemo(() => searchParams.get('verified'), [searchParams]);
  const reason = useMemo(() => searchParams.get('reason'), [searchParams]);

  useEffect(() => {
    if (justVerified === '1') setMessage('Email verificata. Ora puoi accedere.');
    if (reason === 'email_not_confirmed') setMessage('Conferma l’email per poter accedere.');
  }, [justVerified, reason]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      const target = redirectedFrom || '/profile';
      router.replace(target);
      router.refresh();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-8 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h1 className="ui-title">Accedi</h1>
              <p className="ui-muted">Entra nel tuo account per gestire profilo e prenotazioni.</p>
            </div>

            {message ? (
              <div className="ui-alertWarn">
                {message}
              </div>
            ) : null}

            {error ? <div className="ui-error">{error}</div> : null}

            <form onSubmit={onSubmit} className="space-y-3">
              <Field label="Email" required>
                <input
                  className="ui-control ui-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>

              <Field label="Password" required>
                <input
                  className="ui-control ui-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>

              <Button type="submit" variant="primary" fullWidth disabled={loading}>
                {loading ? 'Accesso…' : 'Accedi'}
              </Button>
            </form>

            <div className="ui-authLinks">
              <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/signup')}>
                Crea account
              </Button>
              <button type="button" className="ui-authLinkSecondary" onClick={() => router.push('/forgot-password')}>
                Password dimenticata?
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
