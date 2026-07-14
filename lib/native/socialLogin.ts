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
// NONCE — si comporta in modo diverso sui due provider, e la differenza non è cosmetica.
//
// Apple: il plugin passa il nostro valore così com'è a `ASAuthorizationAppleIDRequest.nonce`
// e Apple lo copia nell'id_token senza hasharlo; Supabase confronta la claim `nonce` del
// token con l'SHA-256 di quello che gli passiamo. Quindi ad Apple va l'hash e a Supabase il
// nonce grezzo. `ASAuthorizationController` fa sempre una richiesta nuova, quindi il nonce
// che mandiamo è sempre quello che finisce nel token.
//
// Google: NIENTE nonce. Se sul dispositivo esiste già una sessione Google, il plugin non
// rifà il login ma chiama `restorePreviousSignIn` (GoogleProvider.swift), percorso in cui il
// nonce non viene passato: l'id_token torna con un nonce vecchio o assente e Supabase
// risponde "Nonces mismatch". Non passando alcun nonce, Supabase salta il controllo e la
// verifica resta su firma, scadenza e `aud` (che deve essere il nostro client iOS: un token
// emesso per un'altra app viene rifiutato). È lo stesso motivo per cui Supabase espone
// l'opzione "Skip nonce checks" citando esplicitamente iOS.

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

  let idToken: string | null;
  let rawNonce: string | undefined;

  if (provider === 'apple') {
    rawNonce = randomNonce();
    const { result } = await SocialLogin.login({
      provider: 'apple',
      options: { scopes: ['email', 'name'], nonce: await sha256Hex(rawNonce) },
    });
    idToken = result.idToken;
  } else {
    const { result } = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'] },
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
    ...(rawNonce ? { nonce: rawNonce } : {}),
  });

  if (error) throw error;
}
