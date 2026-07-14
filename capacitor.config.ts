import type { CapacitorConfig } from '@capacitor/cli';

// ──────────────────────────────────────────────────────────────────────────
// Approccio "Remote URL": il guscio nativo (WKWebView) carica l'app Next.js
// servita su Vercel. Gli aggiornamenti UI non richiedono un nuovo review Apple.
//
// ⚠️ DA CONFERMARE prima del build iOS:
//   - appId    → bundle identifier registrato su Apple Developer
//   - SERVER_URL → dominio di produzione (Vercel) dove gira l'app
//
// In assenza di SERVER_URL la WebView mostra la pagina di fallback in `webDir`.
// ──────────────────────────────────────────────────────────────────────────

const SERVER_URL = process.env.CAPACITOR_SERVER_URL?.trim() || 'https://app.tenutadelbarone.com';

const config: CapacitorConfig = {
  // ⚠️ Deve combaciare con l'App ID (Bundle ID) registrato su Apple Developer.
  // app.tenutadelbarone.client esiste già su Apple → VERIFICARE che sia di tipo
  // "App IDs" e non "Services IDs" (quest'ultimo serve solo a "Accedi con Apple"
  // via web e NON è valido come bundle dell'app nativa: in tal caso registrarne
  // uno nuovo, es. app.tenutadelbarone.app, e aggiornare qui).
  appId: 'app.tenutadelbarone.client',
  appName: 'Tenuta del Barone',
  webDir: 'capacitor-www',
  // Etichetta lo user-agent della WebView (iOS + Android) così il frontend sa di
  // girare nell'app nativa e può applicare override CSS dietro la classe
  // `.native-app` (vedi app/layout.tsx + app/globals.css). NON viene deployato su
  // Vercel: i browser non vedranno mai questo flag.
  appendUserAgent: 'TDBApp',
  ios: {
    // 'never': la WebView occupa tutto lo schermo (anche sotto status bar e home
    // indicator) e le safe area vengono esposte a CSS via env(safe-area-inset-*),
    // così le gestiamo noi in modo prevedibile (vedi .ui-topbarShell, .ui-appMain,
    // .ui-bottomNavShell). 'always' invece le gestiva la WebView in modo opaco.
    contentInset: 'never',
    backgroundColor: '#060807',
  },
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  plugins: {
    // Login social nativo (vedi lib/native/socialLogin.ts). `providers` decide quali SDK
    // finiscono nel binario: teniamo solo Apple e Google, così Facebook/Twitter non
    // vengono impacchettati (app più leggera e nessun SDK di terzi da dichiarare).
    SocialLogin: {
      providers: {
        apple: true,
        google: true,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;
