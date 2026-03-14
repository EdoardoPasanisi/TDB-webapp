// FILE: pawny-webapp/app/account/password/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function ChangePasswordPage() {
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
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 space-y-4">
        <header className="space-y-1">
          <h1 className="ui-title">Modifica password</h1>
          <p className="ui-muted">Inserisci la password attuale e poi quella nuova (minimo 8 caratteri).</p>
        </header>

        <Card>
          <CardContent className="space-y-4">
            <SectionHeader title="Sicurezza account" subtitle="Aggiorna la password di accesso." />

            {doneMessage ? (
              <div className="ui-success">
                Password aggiornata correttamente.
              </div>
            ) : null}

            {errorMessage ? (
              <div className="ui-error">{errorMessage}</div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="current-password" className="ui-body font-[var(--font-weight-semibold)]">
                  Password attuale
                </label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="ui-control ui-input mt-2"
                  required
                />
              </div>

              <div>
                <label htmlFor="new-password" className="ui-body font-[var(--font-weight-semibold)]">
                  Nuova password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ui-control ui-input mt-2"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="ui-body font-[var(--font-weight-semibold)]">
                  Conferma password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="ui-control ui-input mt-2"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={loading}
              >
                {loading ? 'Salvataggio...' : 'Aggiorna password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
