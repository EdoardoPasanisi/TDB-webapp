# Android / Google Play Runbook

Stesso guscio **Capacitor / Remote URL** dell'iOS: la WebView carica
`https://app.tenutadelbarone.com`. Il progetto nativo è in `android/`.

## Stato

- [x] `@capacitor/android` installato, progetto `android/` generato (`cap add android`)
- [x] applicationId `app.tenutadelbarone.client`, app name "Tenuta del Barone", versionCode 1 / versionName 1.0
- [x] Icone, adaptive icon e splash generati per tutte le densità (`capacitor-assets generate --android`)
- [x] Remote URL embedded nel config (`server.url = https://app.tenutadelbarone.com`)
- [ ] Android Studio + JDK 17 + Android SDK installati (per buildare l'AAB)
- [ ] Keystore di firma (upload key) creato e custodito
- [ ] Push FCM (fotocamera nativa)
- [ ] Google Play Console: account, scheda store, Data safety, content rating

## Prerequisiti (quando avrai accesso a una macchina con SDK)

Per **buildare** non serve un dispositivo Android fisico (basta l'emulatore o
direttamente l'AAB), ma serve:

```bash
# Android Studio include SDK + JDK. In alternativa, da CLI:
brew install --cask android-studio
# poi apri Android Studio una volta per installare SDK + platform-tools
```

Lo scaffolding (`cap add android`, generazione asset) è **già fatto** e non
richiede SDK. Da qui in poi (build/firma) serve l'SDK.

## Workflow build

```bash
npx cap sync android      # = npm run cap:sync (sync web + plugin)
npx cap open android      # apre Android Studio
```

In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**.

## Firma — upload key (una tantum)

```bash
keytool -genkey -v -keystore tdb-upload.keystore \
  -alias tdb-upload -keyalg RSA -keysize 2048 -validity 10000
```

- Custodisci il keystore e le password **fuori dal repo** (è in `.gitignore`).
- In produzione conviene usare **Play App Signing** (Google gestisce la signing
  key; tu carichi con la upload key).

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
