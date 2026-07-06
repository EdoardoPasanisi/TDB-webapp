# Handoff — App mobile (iOS App Store + Google Play) e fix layout WebView

> Documento per riprendere il lavoro in una nuova chat senza ricostruire il contesto.
> Ultimo aggiornamento: 2026-06-28.
> Vedi anche i runbook dedicati: [`docs/ios-app-store-runbook.md`](./ios-app-store-runbook.md) e [`docs/google-play-runbook.md`](./google-play-runbook.md).

---

## 1. Obiettivo

Portare la web app **Next.js 16** (SSR + Supabase, deploy su Vercel) sugli store
**Apple App Store** e **Google Play**, senza riscrivere il frontend.

## 2. Architettura: Capacitor in modalità "Remote URL"

Il guscio nativo (Capacitor) è una **WebView a tutto schermo** che carica il sito
di produzione `https://app.tenutadelbarone.com` servito da Vercel. **Non** è un
bundle di asset statici (l'SSR di Next.js non sopravvive a `output: 'export'`).

Conseguenze chiave:
- **Aggiornamenti UI senza re-submit**: basta deployare su Vercel, l'app carica la
  nuova versione. Niente passaggio dallo store per le modifiche frontend.
- **Un solo frontend** condiviso da: browser desktop, browser mobile, app iOS, app
  Android. Questo è il punto centrale del problema di layout (sezione 4).
- **Rischio Apple Guideline 4.2** ("è solo un sito"): mitigato aggiungendo funzioni
  native (push APNs, fotocamera nativa) prima del submit.

> ⚠️ **Il deploy su Vercel è e resta totalmente indipendente dal progetto nativo.**
> Le cartelle `ios/`, `android/`, `capacitor.config.ts`, `capacitor-www/` non vengono
> deployate. Nessuna modifica nativa tocca il sito web.

Config: [`capacitor.config.ts`](../capacitor.config.ts) — `appId: app.tenutadelbarone.client`,
`server.url: https://app.tenutadelbarone.com`.

## 3. Stato attuale (ambiente locale — Mac)

Setup nativo iOS **completato fino al primo Run su device**:

- [x] Xcode 26.5 installato + licenza accettata (`sudo xcodebuild -license accept`)
- [x] CocoaPods 1.16.2 (`brew install cocoapods`)
- [x] Progetto `ios/` generato (`npx cap add ios`)
- [x] Podfile e pbxproj portati a **iOS 15.0** (Capacitor 8.4.1 lo richiede), `pod install` ok
- [x] Asset iOS generati (`npx capacitor-assets generate --ios`)
- [x] `Info.plist`: aggiunte `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
      `NSPhotoLibraryAddUsageDescription`
- [x] `sudo xcodebuild -runFirstLaunch` eseguito → `npx cap sync ios` pulito
- [x] **App installata e provata sull'iPhone fisico**: funzionalità OK (login, sezioni,
      upload foto/documenti con permessi). Carica correttamente il sito di produzione.
- [x] **Layout WebView / safe area — RIFATTO alla radice** (vedi §4 aggiornata):
      `ios.contentInset: 'never'` in `capacitor.config.ts` (la WebView occupa tutto lo
      schermo e le safe area sono esposte a CSS via `env(safe-area-inset-*)`), gestite
      esplicitamente in `app/globals.css`. Risolti: contenuti che finivano sotto la
      status bar, top-bar arancione estesa fin sotto le info del telefono, bottom-nav
      compattata, offset del contenuto corretti su tutte le pagine (incluse login/admin).
- [x] **Login** centrato e "bloccato" (`.ui-authViewport`), **profilo** ristrutturato
      come desktop (top-bar standard senza tasto profilo + banner account in flusso).
- [x] **Stile pulsanti navbar** (colori + look tattile) applicato ad app, browser mobile
      e desktop. Definito in `app/globals.css` dopo le classi base (vale ovunque).
- [x] **Marcatura contesto nativo**: `appendUserAgent: 'TDBApp'` + classe `native-app`
      su `<html>` (script inline in `app/layout.tsx`). Usata ora solo per dimensioni
      chrome dedicate all'app (`--topbar-h`, `--bottom-nav-h`, padding bottom-nav).
- [ ] **Firma in Xcode**: comparivano 2 errori ("team has no devices" + "no profiles
      for app.tenutadelbarone.client"). Sono errori di provisioning di *sviluppo*,
      risolti collegando l'iPhone (registra il device). NB: per l'Archive App Store si
      usa un profilo di *distribuzione*, generato al momento.
- [ ] **App ID su Apple Developer**: verificare che `app.tenutadelbarone.client` sia un
      **App ID** (non un Services ID di "Accedi con Apple"). Xcode non ha dato errore di
      conflitto → probabilmente già valido/auto-registrato, ma confermare su
      developer.apple.com → Identifiers.
- [x] **Fotocamera nativa** (`@capacitor/camera`) — integrata nel picker foto di
      `DogForm`, attiva **solo su iOS** (`lib/native/camera.ts` + `lib/native/platform.ts`);
      browser e Android usano l'`<input file>` come prima.
- [x] **Push APNs — codice completo** (difesa anti-4.2), tutto gated **solo iOS**:
      client `lib/native/push.ts` + `NativePushRegistrar`, endpoint `/api/push/register`,
      tabella `push_tokens` (migration 20260702), invio `lib/notifications/apns.ts`
      agganciato a `createUserNotificationIfEnabled`. Resta il setup Apple/Xcode/env
      (vedi runbook iOS §Push).
- [ ] Push APNs — **setup manuale**: capability su App ID + Xcode, Auth Key .p8, env Vercel
- [ ] Archive + upload su App Store Connect, metadata, privacy labels, screenshot

**Android**: scaffolding già fatto (`android/` generato, asset, Remote URL, applicationId
`app.tenutadelbarone.client`). Bloccato solo su build (serve Android Studio/SDK/JDK +
keystore). Dettagli in [`docs/google-play-runbook.md`](./google-play-runbook.md).

## 4. Il problema di layout: stesso codice, due contesti mobile diversi

### Il problema (capirlo bene)

Il **desktop non c'entra** ed è già a posto. Il problema è **solo nella versione mobile**,
che però gira in **due contesti diversi con la stessa identica CSS**:

| Contesto | Chrome del browser | Viewport / safe area |
|---|---|---|
| **Browser mobile** (Safari/Chrome sul telefono) | C'è la barra del browser in basso | la bottom-nav sta sopra quella barra |
| **App nativa** (WebView Capacitor) | Nessuna barra, a tutto schermo | la bottom-nav arriva fino al bordo + home indicator |

Le proporzioni erano state tarate guardando il **browser mobile**. Nell'**app nativa**
le stesse proporzioni risultano brutte:
- Titolo **"I miei pet"** tagliato dall'header arancione in alto (safe-area-**top** del notch).
- **Bottom-nav**: grosso spazio arancione in basso poco gradevole (safe-area-**bottom**
  dell'home indicator ≈ 34px che il browser invece azzera).

Il vincolo che blocca la soluzione ingenua: se si abbassa/compatta la bottom-nav per stare
bene nell'**app**, nel **browser mobile** finisce sotto la barra del browser. Tarare per
uno rompe l'altro, perché è **lo stesso CSS**.

### La soluzione scelta: marcare il contesto nativo con una classe

Far sì che il codice **sappia in quale contesto gira** e applichi valori diversi:

1. **`capacitor.config.ts`** — aggiungere un'etichetta allo user-agent della WebView
   (sia iOS che Android):
   ```ts
   // dentro la config
   appendUserAgent: 'TDBApp',
   ```
2. **[`app/layout.tsx`](../app/layout.tsx)** — script inline nel `<head>` (gira prima del
   primo paint, niente flash) che aggiunge una classe all'`<html>` solo se nativo:
   ```js
   if (navigator.userAgent.includes('TDBApp')) {
     document.documentElement.classList.add('native-app');
   }
   ```
3. **[`app/globals.css`](../app/globals.css)** — override **solo per l'app**, dietro la classe:
   ```css
   /* browser mobile: RESTA IDENTICO a ora */
   .ui-bottomNavShell { padding-bottom: calc(var(--safe-bottom) + 8px); }

   /* SOLO app nativa: compattata, niente arancione di troppo */
   .native-app .ui-bottomNavShell { padding-bottom: /* valore dedicato */; }

   /* SOLO app nativa: fix titolo tagliato in alto (safe-area-top) */
   .native-app <selettore-header> { padding-top: /* + var(--safe-top) */; }
   ```

**Perché non rompe niente:**
- In un browser (desktop o mobile) lo user-agent **non** contiene `TDBApp` → la classe
  `native-app` non viene mai aggiunta → le regole `.native-app` non si attivano mai.
- Il sito su Vercel resta byte-per-byte identico nel comportamento per i browser.
- `appendUserAgent` è nel progetto nativo, **non** viene deployato.
- Vale automaticamente anche per Android (stesso UA flag).

Nota: `env(safe-area-inset-*)` già differenzia in parte i due contesti (≈34px nativo vs ≈0
browser), ma la classe `.native-app` dà controllo totale per ogni divergenza estetica futura.

### ✅ AGGIORNAMENTO — soluzione effettivamente implementata (supera il piano sopra)

Il piano iniziale (sola classe `.native-app` per divergenze estetiche) si è rivelato
insufficiente: con `contentInset: 'always'` la WebView gestiva le safe area in modo opaco
e **incoerente** (a volte i contenuti finivano sotto la status bar, a volte no; il titolo
del profilo veniva tagliato). Abbiamo preso il controllo esplicito:

1. **`capacitor.config.ts` → `ios.contentInset: 'never'`**: la WebView occupa tutto lo
   schermo (anche sotto status bar e home indicator) ed espone le safe area a CSS via
   `env(safe-area-inset-*)`. Richiede `npx cap sync ios` + rebuild da Xcode.
2. **`app/globals.css`** — gestione esplicita safe area:
   - `.ui-topbarShell`: `height: calc(var(--topbar-h) + var(--safe-top))` + `padding-top:
     var(--safe-top)` → l'arancione si estende **sopra**, fin sotto le info del telefono,
     e i contenuti (icone/titolo) restano sotto la status bar.
   - `.ui-appMain`: `padding-top: calc(var(--safe-top) + ...)` e `padding-bottom:
     calc(var(--safe-bottom) + ...)` anche sulle pagine **senza** chrome (login, admin).
   - Bottom-nav: `.native-app` resta per la sola compattazione (padding + `--bottom-nav-h`).
3. **`next.config.ts`** (solo per il loop dev in HTTP dal telefono):
   - `upgrade-insecure-requests` nella CSP **solo in produzione** (in dev rompeva il
     caricamento HTTP dal dev server locale).
   - `allowedDevOrigins` **auto-rileva gli IP LAN del Mac** (`os.networkInterfaces()`),
     così non va aggiornato a mano quando cambia rete.
4. **`ios/App/App/Info.plist`**: eccezione ATS `NSAllowsArbitraryLoads` **SOLO DEV** (per
   caricare il dev server in HTTP). ⚠️ **Rimuovere prima dell'Archive** (commento marcatore).

### Punti di intervento già individuati nel codice

- Bottom-nav component: [`components/ui/BottomNav.tsx`](../components/ui/BottomNav.tsx)
  (`nav.fixed.bottom-0`, classi `ui-bottomNavShell`, `ui-bottomNavCenterBtn`, ecc.)
- Shell arancione: `.ui-bottomNavShell` in [`app/globals.css`](../app/globals.css) (~riga 829),
  `padding-bottom: calc(var(--safe-bottom) + 8px)`.
- Variabili safe area: `--safe-top` / `--safe-bottom` in `globals.css` (~righe 37-38).
- Header/top: la schermata "I miei pet" col titolo tagliato (header arancione del profilo).

## 5. Loop di sviluppo per iterare sul layout

Siccome la WebView carica Vercel, per vedere le modifiche sul telefono **senza deployare**
ogni volta conviene puntare temporaneamente la WebView al **dev server locale** del Mac:

```bash
# 1. iPhone e Mac sulla STESSA Wi-Fi
# 2. avvia il dev server in ascolto sulla rete
npm run dev   # Next.js su :3000
# 3. trova l'IP locale del Mac (es. 192.168.1.X)
ipconfig getifaddr en0
# 4. punta la WebView al dev server e ricostruisci
CAPACITOR_SERVER_URL=http://192.168.1.X:3000 npx cap sync ios
npx cap run ios   # oppure Run da Xcode
```

`capacitor.config.ts` legge già `process.env.CAPACITOR_SERVER_URL`. **Ricordarsi di
rifare il sync senza la variabile (torna al dominio prod) prima dell'Archive finale.**

In alternativa, iterazione rapida nei **DevTools del browser desktop in modalità telefono**
(approssima la fascia mobile, ma NON riproduce le safe area native: la verifica finale va
fatta sul device).

### Trappole scoperte nel loop (importanti)

- **L'IP del Mac cambia con la rete** (es. `192.168.1.9` su Wi-Fi di casa vs `172.20.10.x`
  sull'hotspot dell'iPhone). Se la WebView resta bianca, ricontrolla `ipconfig getifaddr en0`
  e rifai `CAPACITOR_SERVER_URL=http://<IP>:3000 npx cap sync ios`. `next.config.ts`
  autorizza già da solo qualunque IP LAN del Mac (nessun `allowedDevOrigins` da aggiornare).
- **Modifiche CSS che non arrivano**: Turbopack a volte **smette di ricompilare
  `globals.css`** e serve una versione vecchia (stesso URL chunk, contenuto stale) — nemmeno
  riavviare basta. Fix: `rm -rf .next` + `npm run dev`. Se ricorre spesso, avviare con
  `next dev --webpack` (HMR CSS più affidabile). Solo dev, non tocca produzione/app.
- **Cache della WebView iOS**: se dopo il fix il telefono mostra ancora il vecchio CSS,
  elimina l'app dal telefono e reinstalla (Run) per svuotare la cache di WKWebView.
- **Login su HTTP**: i cookie "secure" di Supabase non si salvano su `http://` → in dev il
  login può non persistere tra sessioni. È normale, riguarda solo il loop locale.

## 6. Prossimi passi (ordine consigliato)

1. **Fix layout WebView + UI** (sezione 4 aggiornata): ✅ **sostanzialmente completato**
   (safe area con `contentInset: 'never'`, top-bar arancione estesa, offset contenuto,
   login centrato, profilo ristrutturato, stile pulsanti colorati/tattili su app+browser).
   Restano solo: (a) eventuale taratura fine dei valori guardando il device; (b) **ricordarsi
   di RIMUOVERE l'eccezione ATS DEV** dal `Info.plist` prima dell'Archive; (c) rifare
   `npx cap sync ios` **senza** `CAPACITOR_SERVER_URL` per tornare al dominio di produzione.
2. **Confermare App ID** `app.tenutadelbarone.client` su Apple Developer (App ID, non Services ID).
3. **Push APNs + fotocamera nativa** (anti-rejection 4.2): ✅ **codice completato**
   (tutto gated solo iOS). Resta il **setup manuale**: capability Push sull'App ID,
   APNs Auth Key .p8 (Key ID + Team ID), capability in Xcode (Push + Background Modes),
   env `APNS_*` su Vercel — vedi runbook iOS §Push.
4. **Applicare migration** `20260702000000_push_tokens.sql` su Supabase (a mano).
5. **Archive + upload** su App Store Connect; metadata, privacy labels, screenshot, age rating.
5. **Android**: Android Studio/SDK/JDK + keystore → build AAB → Play Console (vedi runbook Android).

## 7. Comandi utili

```bash
npm run cap:sync            # npx cap sync (web + plugin)
npm run cap:open            # apre Xcode (ios)
npx cap run ios             # build + run su device/simulatore
npx capacitor-assets generate --ios   # rigenera icone/splash da assets/
```

## 8. Note legali / store (già a posto)

- Eliminazione account in-app: ✅ (`lib/account/deleteAccount.ts`, route `DELETE /api/account`,
  UI in Impostazioni). Requisito Apple 5.1.1(v) e Google.
- Pagamenti: solo servizi reali (pensione/addestramento) → esenti da IAP/Play Billing.
- Pagine legali: `/privacy`, `/terms`, `/cookies` presenti. Auth solo email.
