'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';

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
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setChecking(false);
    };
    void run();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
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

      setDoneMessage('Password aggiornata. Verrai reindirizzato al login…');
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
      <main className="ui-page min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent>
            <p className="ui-muted">Verifica link in corso…</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h1 className="ui-title">Link non valido o scaduto</h1>
              <p className="ui-muted">
                Il link di recupero non è valido oppure è scaduto. Richiedine uno nuovo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button type="button" variant="primary" fullWidth onClick={() => router.push('/forgot-password')}>
                Richiedi nuovo link
              </Button>
              <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/login')}>
                Torna al login
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-8 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h1 className="ui-title">Imposta nuova password</h1>
              <p className="ui-muted">Scegli una password nuova e confermala.</p>
            </div>

            {doneMessage ? (
              <div className="ui-alertWarn">
                {doneMessage}
              </div>
            ) : null}

            {errorMessage ? <div className="ui-error">{errorMessage}</div> : null}

            <form onSubmit={handleSubmit} className="space-y-3">
              <Field label="Nuova password" required hint="Minimo 8 caratteri.">
                <PasswordInput
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              <Field label="Conferma password" required>
                <PasswordInput
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </Field>

              <Button type="submit" variant="primary" fullWidth disabled={loading}>
                {loading ? 'Salvataggio…' : 'Aggiorna password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
