// Login social nativo (Apple / Google) — SOLO app iOS.
//
// Perché non basta `signInWithOAuth` dentro l'app: quella chiamata naviga la WebView
// verso l'endpoint /authorize di Supabase, che sta su un host diverso da `server.url`.
// Capacitor intercetta le navigazioni fuori host e le apre nel browser di sistema:
// l'intero flusso OAuth si svolgeva quindi in Safari e i cookie di sessione finivano
// nel cookie store di Safari, mai in quello della WKWebView → l'app restava sloggata.
// È il bug per cui App Review ha respinto la 1.0(2) (Guideline 2.1(a), 10/07/2026).
//
// Qui usiamo i flussi nativi (ASAuthorizationController su Apple, Google Sign-In SDK):
// il provider restituisce un identity token che scambiamo con Supabase via
// `signInWithIdToken`. La sessione viene scritta dal client di @supabase/ssr nei cookie
// della WebView, quindi middleware e SSR la vedono esattamente come dopo un login con
// password — nessun browser esterno, nessun redirect.
//
// NONCE — il punto delicato. Il plugin passa il valore che gli diamo *così com'è* a
// `ASAuthorizationAppleIDRequest.nonce` / a GIDSignIn, e i provider lo copiano
// nell'id_token senza hasharlo. Supabase invece confronta la claim `nonce` del token
// con l'SHA-256 del nonce che riceve. Quindi: al provider va l'hash, a Supabase il
// nonce grezzo.

import { supabase } from '@/lib/supabaseClient';
import { getNativePlatform } from './platform';

export type SocialProvider = 'apple' | 'google';

// OAuth client di tipo iOS creato su Google Cloud. Senza, il flusso Google nativo non
// esiste e il pulsante va nascosto nell'app (vedi getNativeSocialProviders): mostrarlo
// significherebbe ricadere nel flusso web, cioè nel bug che ha causato il reject.
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';

let initialization: Promise<void> | null = null;

async function loadPlugin() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');

  if (!initialization) {
    initialization = SocialLogin.initialize({
      // Su iOS il client Apple è il bundle id dell'app: niente da configurare.
      apple: {},
      ...(GOOGLE_IOS_CLIENT_ID ? { google: { iOSClientId: GOOGLE_IOS_CLIENT_ID } } : {}),
    }).catch((error: unknown) => {
      initialization = null; // consente un nuovo tentativo al prossimo tap
      throw error;
    });
  }

  await initialization;
  return SocialLogin;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

/**
 * Provider utilizzabili in modalità nativa sulla piattaforma corrente.
 * Nel browser (e su Android, che usa ancora il flusso web) torna sempre [].
 */
export async function getNativeSocialProviders(): Promise<SocialProvider[]> {
  if ((await getNativePlatform()) !== 'ios') return [];
  return GOOGLE_IOS_CLIENT_ID ? ['apple', 'google'] : ['apple'];
}

/** L'utente ha chiuso il foglio di login: non è un errore da mostrare. */
export function isUserCancelledSocialLogin(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: unknown }).code === 'USER_CANCELLED') return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && /cancell?ed/i.test(message);
}

/**
 * Esegue il login nativo e apre la sessione Supabase.
 * Al ritorno la sessione è già nei cookie: al chiamante basta navigare.
 */
export async function signInWithNativeProvider(provider: SocialProvider): Promise<void> {
  const SocialLogin = await loadPlugin();

  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  let idToken: string | null;

  if (provider === 'apple') {
    const { result } = await SocialLogin.login({
      provider: 'apple',
      options: { scopes: ['email', 'name'], nonce: hashedNonce },
    });
    idToken = result.idToken;
  } else {
    const { result } = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'], nonce: hashedNonce },
    });
    // In modalità 'offline' il plugin torna solo un serverAuthCode: qui usiamo la
    // default 'online', che include l'id_token.
    idToken = 'idToken' in result ? result.idToken : null;
  }

  if (!idToken) {
    throw new Error('Il provider non ha restituito un identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider,
    token: idToken,
    nonce: rawNonce,
  });

  if (error) throw error;
}
