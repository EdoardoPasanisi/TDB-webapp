# iOS / App Store Runbook

Guscio nativo **Capacitor** in modalità **Remote URL**: la WebView carica l'app
Next.js servita su `https://app.tenutadelbarone.com`. Gli aggiornamenti della UI
non richiedono un nuovo review Apple (basta deployare su Vercel).

## Stato

- [x] Pacchetti Capacitor installati (`@capacitor/core`, `cli`, `ios`)
- [x] `capacitor.config.ts` (Remote URL) + fallback offline in `capacitor-www/`
- [x] Sorgenti asset in `assets/` (`icon.png` 1024², `splash*.png` 2732², senza alpha)
- [x] Eliminazione account in-app (requisito 5.1.1-v)
- [x] Xcode installato (26.5) + licenza accettata
- [x] CocoaPods installato (1.16.2)
- [x] Progetto `ios/` generato (`pod install` ok, deployment target 15.0)
- [x] Asset iOS generati + Info.plist usage strings camera/foto
- [ ] `sudo xcodebuild -runFirstLaunch` (componenti primo avvio Xcode)
- [x] Fotocamera nativa (`@capacitor/camera`) integrata in DogForm, gated iOS
- [x] Push APNs — **codice** completo (client + endpoint + tabella + invio), gated iOS
- [ ] App ID confermato su Apple Developer (appId attuale: app.tenutadelbarone.client)
- [ ] Push APNs — **setup Apple/Xcode/env**: capability, Auth Key .p8, env Vercel
- [ ] Rimuovere blocco ATS DEV da Info.plist prima dell'Archive
- [ ] Firma in Xcode (team) + Archive/upload
- [ ] App Store Connect (metadata, privacy labels, screenshot)

## Prerequisiti (una tantum)

```bash
# 1. Xcode dal Mac App Store, poi:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept

# 2. CocoaPods
brew install cocoapods
```

## Dove trovare il Bundle ID (App ID)

L'`appId` in `capacitor.config.ts` (`com.tenutadelbarone.app`) **deve combaciare**
con l'App ID registrato su Apple:

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles**
   → **Identifiers**. Se esiste già un'app, l'App ID è lì (formato reverse-DNS).
2. Oppure su **App Store Connect** → **App** → la tua app → **App Information**
   → campo **Bundle ID**.
3. Se non esiste ancora, lo crei in **Identifiers → +** e usi lo stesso valore
   nel config. Abilita la capability **Push Notifications** sull'App ID.

## Generare il progetto iOS

```bash
npx cap add ios
npx capacitor-assets generate --ios   # icone + launch screen da assets/
npx cap sync ios                       # = npm run cap:sync
npx cap open ios                       # apre Xcode = npm run cap:open
```

## Info.plist — stringhe d'uso (obbligatorie)

In `ios/App/App/Info.plist` aggiungere (l'upload foto pet/documenti usa la
fotocamera/galleria; senza queste chiavi l'app va in crash al primo accesso):

```xml
<key>NSCameraUsageDescription</key>
<string>Per scattare foto del tuo pet e dei documenti da caricare nel profilo.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Per scegliere foto del tuo pet e documenti dalla galleria.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Per salvare nella galleria i media condivisi dalla struttura.</string>
```

## Push notifiche (APNs)

### ✅ Codice già implementato (2026-07-02)

Tutta la parte software è pronta e gated **solo iOS** (Android e browser non
eseguono nulla — APNs è Apple-specifico):

- Client: [`lib/native/push.ts`](../lib/native/push.ts) (`@capacitor/push-notifications`,
  permesso + `register()` + invio token) montato via
  [`components/native/NativePushRegistrar.tsx`](../components/native/NativePushRegistrar.tsx)
  dentro `AuthenticatedAppChrome` (parte solo con utente loggato).
- Endpoint: [`app/api/push/register/route.ts`](../app/api/push/register/route.ts)
  (POST/DELETE, salva in `push_tokens`).
- Tabella: migration [`supabase/migrations/20260702000000_push_tokens.sql`](../supabase/migrations/20260702000000_push_tokens.sql)
  (FK `auth.users` ON DELETE CASCADE → pulizia automatica all'eliminazione account).
- Invio: [`lib/notifications/apns.ts`](../lib/notifications/apns.ts) (JWT ES256 via
  `node:crypto`, HTTP/2 via `node:http2`, zero dipendenze extra), agganciato in
  [`lib/notifications/server.ts`](../lib/notifications/server.ts) dentro
  `createUserNotificationIfEnabled` (fire-and-forget accanto alla notifica in-app).

### Cosa resta da fare TU (portale Apple + Xcode + env)

1. **Apple Developer** → Identifiers → App ID `app.tenutadelbarone.client` →
   abilita capability **Push Notifications**.
2. **Apple Developer** → Keys → **+** → crea una **APNs Auth Key (.p8)**.
   Scarica il file `.p8` (una sola volta!) e **annota Key ID + Team ID**.
3. **Xcode** → target App → **Signing & Capabilities** → **+ Capability** →
   **Push Notifications**, poi **Background Modes → Remote notifications**.
4. **Env var su Vercel** (Production) — poi redeploy:
   ```
   APNS_KEY_ID       = <Key ID della .p8>
   APNS_TEAM_ID      = <Apple Developer Team ID>
   APNS_PRIVATE_KEY  = <contenuto del .p8, newline come \n oppure multilinea>
   APNS_BUNDLE_ID    = app.tenutadelbarone.client   (opzionale, è il default)
   APNS_ENV          = production                    (usa 'sandbox' per build di test)
   ```
   Senza queste env `sendApnsToUser` è un no-op sicuro (non rompe le notifiche in-app).

## Auth Supabase nella WebView

- Login email/password e sessione funzionano dentro la WebView (stesso origin
  `app.tenutadelbarone.com`): nessuno schema custom necessario.
- I link di **conferma email** e **reset password** aprono Safari, non l'app.
  Per riportarli nell'app servono **Universal Links** (Associated Domains +
  file `apple-app-site-association` servito dal dominio). Miglioria post-MVP.
- Verifica che le **Redirect URLs** in Supabase Auth includano il dominio prod.

## Build & upload

1. Xcode → seleziona team di firma, imposta versione/build.
2. **Product → Archive** → **Distribute App → App Store Connect**.
3. Su App Store Connect completa metadata, privacy labels, screenshot, age
   rating, URL supporto e privacy policy (`/privacy`), poi invia al review.

## Note review (anti-rejection)

- **4.2 Minimum Functionality**: le push native + fotocamera nativa sono la
  difesa principale contro il "è solo un sito". Implementarle prima del submit.
- **5.1.1(v)**: eliminazione account in-app già presente (Impostazioni →
  Elimina account).
- Pagamenti: solo servizi reali (pensione/addestramento) → esenti da IAP.
