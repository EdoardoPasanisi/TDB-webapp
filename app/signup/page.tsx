'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (!userError && data.user) {
        router.push('/profile');
      }
    };
    void checkUser();
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const emailRedirectTo = `${window.location.origin}/auth/callback`;

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (signupError || !data.user) {
      setError(signupError?.message ?? 'Errore nella registrazione.');
      setLoading(false);
      return;
    }

    if (data.session) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }

    setLoading(false);
    router.push(`/signup/check-email?email=${encodeURIComponent(email)}`);
  };

  return (
    <main className="min-h-screen bg-[var(--brand-bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-8 space-y-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <h1 className="ui-title">Registrati</h1>
              <p className="ui-muted">Crea il tuo account per iniziare a usare l’app.</p>
            </div>

            {error ? <div className="ui-error">{error}</div> : null}

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

              <Field label="Password" required hint="Minimo 8 caratteri.">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ui-control ui-input"
                  required
                />
              </Field>

              <Button type="submit" variant="primary" fullWidth disabled={loading}>
                {loading ? 'Creazione account…' : 'Crea account'}
              </Button>
            </form>

            <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/login')}>
              Hai già un account? Accedi
            </Button>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button type="button" variant="ghost" fullWidth onClick={() => router.push('/privacy')}>
                Privacy
              </Button>
              <Button type="button" variant="ghost" fullWidth onClick={() => router.push('/terms')}>
                Termini
              </Button>
              <Button type="button" variant="ghost" fullWidth onClick={() => router.push('/cookies')}>
                Cookie
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
