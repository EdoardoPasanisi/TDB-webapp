# Android / Google Play Runbook

Stesso guscio **Capacitor / Remote URL** dell'iOS: la WebView carica
`https://app.tenutadelbarone.com`. Il progetto nativo è in `android/`.

## Stato (aggiornato 2026-07-24)

- [x] `@capacitor/android` installato, progetto `android/` generato (`cap add android`)
- [x] applicationId `app.tenutadelbarone.client`, app name "Tenuta del Barone", versionCode 1 / versionName 1.0
- [x] Icone, adaptive icon e splash generati per tutte le densità (`capacitor-assets generate --android`)
- [x] Remote URL embedded nel config (`server.url = https://app.tenutadelbarone.com`)
- [x] Toolchain di build installata **da riga di comando** (no Android Studio grafico
      necessario): JDK 17 + JDK 21 (Homebrew `openjdk@17`/`openjdk@21`) + Android
      command-line tools (Homebrew `android-commandlinetools`, cartella
      `/opt/homebrew/share/android-commandlinetools`). Variabili d'ambiente già
      aggiunte a `~/.zshrc` (nuovo terminale = pronte in automatico).
- [x] Bump necessario per compilare i plugin nativi già presenti (camera/push/social
      login, scritti per iOS ma sincronizzati anche su Android da `cap sync`):
      `compileSdk`/`targetSdk` 35→**36**, `minSdk` 23→**24** (Android 7.0, copre >99%
      dei dispositivi attivi), Android Gradle Plugin 8.7.2→**8.11.0**, Gradle
      wrapper 8.11.1→**8.13**. File toccati: `variables.gradle`, `build.gradle`,
      `gradle/wrapper/gradle-wrapper.properties`.
- [x] **Build verificata end-to-end da terminale**: `./gradlew assembleDebug` e
      `./gradlew bundleRelease` completano con successo (AAB prodotto in
      `android/app/build/outputs/bundle/release/app-release.aab`, ancora **non
      firmato** — manca solo la keystore, vedi sotto).
- [x] `android/app/build.gradle`: aggiunto un `signingConfigs.release` **condizionale**,
      che si attiva da solo leggendo 4 proprietà da `~/.gradle/gradle.properties`
      (file globale, mai nel repo). Finché non esistono, il build non cambia
      comportamento (AAB non firmato come ora).
- [x] Keystore di firma (upload key) creata dall'utente in `~/tdb-upload.keystore`,
      alias `tdb-upload`, credenziali in `~/.gradle/gradle.properties` (fuori repo).
      **AAB firmato verificato**: `jarsigner -verify` → `jar verified.` su
      `android/app/build/outputs/bundle/release/app-release.aab`.
- [ ] Push FCM, fotocamera nativa su Android — non implementate, ma NON bloccanti
      (vedi nota in fondo al file).
- [x] Google Play Console: account creato e verificato dall'utente.
- [ ] Scheda store, Data safety, content rating — testi pronti in
      `docs/google-play-listing.md`, da incollare in Console.

## Workflow build (da terminale, senza Android Studio)

Le variabili d'ambiente sono già in `~/.zshrc` — **apri un nuovo terminale** (o
`source ~/.zshrc`) perché siano attive.

```bash
npx cap sync android                  # sync web + plugin nativi
cd android
./gradlew bundleRelease               # produce app-release.aab (firmato se la keystore è configurata, vedi sotto)
```

Se preferisci comunque l'interfaccia grafica in futuro, resta possibile:
`brew install --cask android-studio`, poi `npx cap open android`.

## Firma — upload key (una tantum, DA FARE TU nel TUO terminale)

Il file `.keystore` e le sue password sono l'identità con cui firmerai **ogni
futuro aggiornamento** dell'app: se li perdi, non potrai più aggiornare l'app su
Play con lo stesso account. Per questo vanno generati **nel tuo terminale**, non
in questa chat (le password non devono mai transitare da qui).

1. Genera la keystore (ti chiederà una password per la keystore e una per la
   chiave — puoi usare la stessa; annotale in un password manager):
   ```bash
   cd ~                              # o dove preferisci custodirla, FUORI dal repo
   keytool -genkey -v -keystore tdb-upload.keystore \
     -alias tdb-upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Aggiungi (o crea) `~/.gradle/gradle.properties` con queste 4 righe (percorso
   assoluto della keystore, le password che hai scelto sopra):
   ```properties
   TDB_UPLOAD_STORE_FILE=/Users/edoardo/tdb-upload.keystore
   TDB_UPLOAD_STORE_PASSWORD=<la tua password keystore>
   TDB_UPLOAD_KEY_ALIAS=tdb-upload
   TDB_UPLOAD_KEY_PASSWORD=<la tua password chiave>
   ```
   Questo file è **globale al tuo Mac**, fuori da qualunque repository git: non
   verrà mai committato né visto da me.
3. Da quel momento, `cd android && ./gradlew bundleRelease` produce direttamente
   un AAB **firmato**, pronto per l'upload su Play Console.
4. In Play Console, quando carichi il primo AAB, attiva **Play App Signing**
   (consigliato, default): Google gestisce la chiave di distribuzione finale, tu
   continui a firmare solo con questa upload key per ogni nuova versione.

## Permessi (AndroidManifest.xml)

Oggi è presente solo `INTERNET`. Da aggiungere quando si introducono le feature
native:

```xml
<!-- Fotocamera nativa per foto pet/documenti -->
<uses-permission android:name="android.permission.CAMERA" />
<!-- Notifiche push su Android 13+ -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Push notifiche (FCM)

1. Crea un progetto **Firebase**, aggiungi un'app Android con package
   `app.tenutadelbarone.client`, scarica `google-services.json` in `android/app/`.
2. `npm i @capacitor/push-notifications`, registra il token e invialo al backend
   (tabella condivisa `push_tokens`, vedi runbook iOS).
3. Invio server-side via FCM HTTP v1, agganciato dove si creano le righe in
   `notifications` (`lib/notifications/server.ts`).

## Google Play Console — checklist submission

- Account Google Play Developer (25 $ una tantum).
- Scheda store: titolo, descrizione breve/lunga, screenshot (telefono + tablet),
  feature graphic 1024×500, icona 512×512.
- **Data safety form**: dichiara i dati raccolti (profilo, email, foto, documenti)
  e l'uso. Coerente con `/privacy`.
- **Content rating** questionario.
- URL privacy policy pubblico → `https://app.tenutadelbarone.com/privacy`.
- **Account deletion**: Google richiede un percorso di cancellazione account; è
  già in-app (Impostazioni → Elimina account) — dichiara anche l'URL/метodo nel
  form "Delete account" della Console.
- Target API level: assicurati che `targetSdkVersion` rispetti il minimo Play
  corrente (alza `rootProject.ext.targetSdkVersion` se necessario).

## Note

- Pagamenti: solo servizi reali (pensione/addestramento) → esenti da Play Billing.
- Il rischio "è solo un sito" su Play è molto più basso che su Apple, ma push +
  fotocamera native restano consigliate per UX.

## Fix 1.0.1 (versionCode 2) — feedback tester + rifiuto accesso produzione (2026-09-28)

Cosa cambia nel guscio:
- **Tasto/gesto indietro**: prima chiudeva l'app; ora torna alla schermata precedente
  (`@capacitor/app`, `components/native/NativeBackButton.tsx`), e sulla prima
  schermata manda l'app in background.
- **Barre di sistema**: sfondo finestra `#060807` (via la "barra grigia"), stile
  `SystemBars: DARK` (icone status bar e tasti di navigazione chiari, prima neri su
  nero), niente velo di contrasto. Safe-area Android via `--safe-area-inset-*`
  (`.native-android` in `app/globals.css`).
- **Login social**: rilevamento app via user-agent (prima a volte il bridge diceva
  "web" → pulsanti che comparivano a intermittenza e flusso OAuth nel browser).
  Android: solo **Google nativo** (Credential Manager); Apple solo su iOS.

Da fare a mano per attivare Google su Android (senza, il pulsante resta nascosto):
1. Play Console → Configurazione → **Integrità app** → Firma dell'app: copia lo
   **SHA-1 della chiave di firma dell'app** (e, per provare build caricate a mano,
   anche quello della chiave di caricamento: `keytool -list -v -keystore ~/tdb-upload.keystore`).
2. Google Cloud Console (stesso progetto del client iOS) → Credenziali → Crea ID
   client OAuth → tipo **Android**, package `app.tenutadelbarone.client`, SHA-1 del
   punto 1 (un client Android per ogni SHA-1).
3. Vercel → env `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` = client **Web** già usato dal
   provider Google su Supabase → redeploy.
4. Supabase → Auth → Providers → Google: il client Web dev'essere tra i Client IDs
   (di solito lo è già: è quello principale).

Avvisi Play "API deprecate edge-to-edge" (`setStatusBarColor` ecc.): vengono da
librerie di terzi (Material Components via `@capacitor/camera`, androidbrowserhelper
via social-login). Sono **raccomandazioni, non bloccanti**; il nostro codice non usa
quelle API. Spariranno aggiornando i plugin quando i maintainer migrano.
