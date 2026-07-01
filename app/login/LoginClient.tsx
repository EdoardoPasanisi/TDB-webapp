'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';

function getErrorMessage(error: unknown): string {
  return humanizeErrorMessage(error, 'Non siamo riusciti a completare l’accesso. Riprova.');
}

function resolveSafeRedirect(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectedFrom = useMemo(
    () => resolveSafeRedirect(searchParams.get('next') ?? searchParams.get('redirectedFrom')),
    [searchParams]
  );
  const justVerified = useMemo(() => searchParams.get('verified'), [searchParams]);
  const reason = useMemo(() => searchParams.get('reason'), [searchParams]);
  const callbackError = useMemo(() => searchParams.get('e'), [searchParams]);

  useEffect(() => {
    setError(null);
    setMessage(null);
    if (justVerified === '1') setMessage('Email verificata. Ora puoi accedere.');
    if (reason === 'email_not_confirmed') setMessage('Conferma l’email per poter accedere.');
    if (reason === 'confirmation_link_used_or_expired') {
      setMessage('La tua email è quasi certamente già confermata: prova ad accedere qui sotto. Il link di conferma è valido una sola volta.');
    }
    if (callbackError === 'callback_failed' || callbackError === 'callback_session_invalid') {
      setMessage('Non sono riuscito a completare la conferma da questo link. Prova ad accedere o richiedi un nuovo invio.');
    }
  }, [callbackError, justVerified, reason]);

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
        setError(humanizeErrorMessage(error, 'Non siamo riusciti a completare l’accesso. Riprova.'));
        return;
      }

      window.location.replace(redirectedFrom);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ui-page ui-authViewport">
      <div className="ui-authViewportInner mx-auto w-full max-w-md px-4 space-y-4">
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
                <PasswordInput
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

            <SocialAuthButtons next={redirectedFrom} />

            <div className="ui-authLinks">
              <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/signup')}>
                Crea account
              </Button>
              <button type="button" className="ui-authLinkSecondary" onClick={() => router.push('/forgot-password')}>
                Password dimenticata?
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
              <Link href="/privacy" className="ui-legalLink">
                Privacy
              </Link>
              <Link href="/terms" className="ui-legalLink">
                Termini
              </Link>
              <Link href="/cookies" className="ui-legalLink">
                Cookie
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
