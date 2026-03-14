'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setDoneMessage(null);
    setErrorMessage(null);
    setLoading(true);

    try {
      const redirectTo = origin ? `${origin}/reset-password` : undefined;
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      setDoneMessage(
        'Se l’indirizzo è registrato, riceverai un’email con le istruzioni per reimpostare la password.'
      );
    } catch {
      setErrorMessage('Qualcosa è andato storto. Riprova tra poco.');
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
              <h1 className="ui-title">Recupera password</h1>
              <p className="ui-muted">
                Inserisci la tua email. Se registrata, riceverai un link per impostare una nuova password.
              </p>
            </div>

            {doneMessage ? (
              <div className="ui-alertWarn">
                {doneMessage}
              </div>
            ) : null}

            {errorMessage ? <div className="ui-error">{errorMessage}</div> : null}

            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Email" required>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ui-control ui-input"
                  required
                />
              </Field>

              <Button type="submit" variant="primary" fullWidth disabled={loading}>
                {loading ? 'Invio in corso…' : 'Invia email di recupero'}
              </Button>
            </form>

            <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/login')}>
              Torna al login
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
