'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { isNativeApp } from '@/lib/native/platform';
import {
  getNativeSocialProviders,
  isUserCancelledSocialLogin,
  signInWithNativeProvider,
  type SocialProvider,
} from '@/lib/native/socialLogin';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.65 4.1-5.5 4.1A6.2 6.2 0 0 1 12 5.8a5.6 5.6 0 0 1 3.96 1.55l2.7-2.6A9.5 9.5 0 0 0 12 2.2 9.8 9.8 0 1 0 12 21.8c5.66 0 9.4-3.98 9.4-9.58 0-.64-.07-1.13-.16-1.62H12Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.49ZM14.2 6.06c.6-.73 1.01-1.74.9-2.76-.87.04-1.93.58-2.55 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.5 2.57-1.23Z" />
    </svg>
  );
}

export function SocialAuthButtons({ next = '/' }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<SocialProvider | null>(null);
  // null finché non sappiamo se siamo nell'app: nel dubbio si rende il set completo
  // (comportamento browser), poi l'effetto nasconde ciò che in app non è disponibile.
  const [nativeProviders, setNativeProviders] = useState<SocialProvider[] | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!(await isNativeApp())) return;
      const providers = await getNativeSocialProviders();
      if (active) setNativeProviders(providers);
    })();
    return () => {
      active = false;
    };
  }, []);

  const isHidden = (provider: SocialProvider) =>
    nativeProviders !== null && !nativeProviders.includes(provider);

  const signIn = async (provider: SocialProvider) => {
    setError(null);
    setPending(provider);
    try {
      // Dentro l'app il flusso OAuth web è vietato: Capacitor lo aprirebbe nel browser
      // di sistema e la sessione non tornerebbe mai nella WebView (vedi lib/native/socialLogin.ts).
      if (await isNativeApp()) {
        const providers = await getNativeSocialProviders();
        if (!providers.includes(provider)) {
          setError('Questo accesso non è disponibile nell’app. Usa l’email o un altro provider.');
          setPending(null);
          return;
        }
        await signInWithNativeProvider(provider);
        window.location.replace(next);
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(humanizeErrorMessage(oauthError, 'Accesso non riuscito. Riprova.'));
        setPending(null);
      }
      // in caso di successo il browser viene reindirizzato al provider
    } catch (e) {
      if (isUserCancelledSocialLogin(e)) {
        setPending(null);
        return;
      }
      setError(humanizeErrorMessage(e, 'Accesso non riuscito. Riprova.'));
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="ui-muted text-xs">oppure</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {error ? <div className="ui-error">{error}</div> : null}

      {isHidden('google') ? null : (
        <button
          type="button"
          onClick={() => signIn('google')}
          disabled={pending !== null}
          style={{ backgroundColor: '#ffffff', color: '#1f1f1f', borderColor: 'rgba(0,0,0,0.12)' }}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius)] border px-4 text-center text-[15px] font-[var(--font-weight-semibold)] disabled:opacity-60"
        >
          <GoogleIcon />
          <span>{pending === 'google' ? 'Accesso…' : 'Continua con Google'}</span>
        </button>
      )}

      {isHidden('apple') ? null : (
        <button
          type="button"
          onClick={() => signIn('apple')}
          disabled={pending !== null}
          style={{ backgroundColor: '#000000', color: '#ffffff' }}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius)] px-4 text-center text-[15px] font-[var(--font-weight-semibold)] disabled:opacity-60"
        >
          <AppleIcon />
          <span>{pending === 'apple' ? 'Accesso…' : 'Continua con Apple'}</span>
        </button>
      )}
    </div>
  );
}
