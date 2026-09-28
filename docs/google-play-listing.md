# Kit metadati Google Play — Tenuta del Barone

Contenuti pronti da incollare in **Google Play Console → la tua app → Presenza sullo
store / Data safety / Content rating**. Lingua principale: **Italiano**.
Package name: `app.tenutadelbarone.client`. Complementare al runbook tecnico
`docs/google-play-runbook.md` (build/firma/AAB): questo file è solo contenuti/testi.

---

## 1. Nome, descrizione breve

**Nome app** (max 30 caratteri):
```
Tenuta del Barone
```
(oppure `Tenuta del Barone App` se il nome risultasse occupato — stesso caso già previsto per Apple)

**Descrizione breve** (max 80 caratteri — campo che NON esiste su Apple, va scritto ex novo):
```
Prenota pensione, asilo e servizi per il tuo pet. Scheda, documenti, notifiche.
```
(79 caratteri)

---

## 2. Descrizione completa (max 4000 caratteri)

Riusa la stessa descrizione già pronta per Apple in `docs/app-store-listing.md` §2 — è identica
per struttura e limite (4000 char), nessun adattamento necessario:

```
Tenuta del Barone è l'app ufficiale per i clienti della struttura: gestisci i tuoi animali e prenoti i nostri servizi in pochi tocchi.

I TUOI PET, SEMPRE CON TE
• Crea il profilo di cani, gatti e altri animali con foto, razza, microchip e data di nascita.
• Scheda pet con codice QR da mostrare in struttura.
• Carica e conserva i documenti (libretto sanitario, vaccinazioni, documento d'identità) direttamente dall'app, anche scattando una foto.

PRENOTA I NOSTRI SERVIZI
• Pensione — soggiorno per il tuo animale, con scelta di date, orari e alloggio.
• Asilo — la giornata del tuo pet in struttura.
• Addestramento — percorsi educativi personalizzati.
• Consulenza — supporto dedicato.
• Pet taxi — trasporto da e per la struttura.

TUTTO SOTTO CONTROLLO
• Calendario delle prenotazioni e storico.
• Notifiche per conferme e aggiornamenti (in app e via email).
• Saldo sempre aggiornato.
• Gestione dei tuoi dati e del profilo, con eliminazione dell'account direttamente dall'app.

L'accesso avviene con email e password. L'app è riservata ai clienti della Tenuta del Barone.

Tenuta del Barone srls — Via Davide Passigli 60, 00054 Fiumicino (RM).
```

> Nota: su Android non ci sono ancora login social nativi (Google/Apple sono nascosti in-app,
> vedi §7 sotto) — non menzionarli nella descrizione Play, solo email/password.

---

## 3. Grafica richiesta (obbligatoria, non riusabile da Apple — formati diversi)

| Asset | Specifica |
|---|---|
| Icona app | 512×512 px, PNG 32-bit con alpha |
| Feature graphic | 1024×500 px, JPG/PNG **senza** alpha |
| Screenshot telefono | Min 2, consigliati 4–6. JPEG/PNG, rapporto 16:9 o 9:16, lato corto ≥320px, lato lungo ≤3840px |
| Screenshot tablet (opzionale) | 7" e 10", stesso rapporto |

Shot list: stessa di Apple (`docs/app-store-listing.md` §8) — login, "I miei pet", scheda pet
con QR, documenti, servizi, prenotazione pensione. Vanno rifatti dall'emulatore/device Android
(dimensioni diverse da iOS, non riusabili 1:1).

---

## 4. URL e contatti

| Campo | Valore |
|---|---|
| Sito web | `https://app.tenutadelbarone.com` |
| Email di contatto | `info@tenutadelbarone.com` |
| Privacy Policy URL | `https://app.tenutadelbarone.com/privacy` |
| Telefono (opzionale) | — |

---

## 5. Data safety form (equivalente Android dell'App Privacy di Apple)

Stessi dati reali già dichiarati per Apple (`docs/app-store-listing.md` §5), mappati sulle
categorie Google. Per ogni voce: **raccolto** = Sì, **condiviso con terzi** = No,
**crittografato in transito** = Sì, **finalità** = App functionality / Account management,
**cancellabile su richiesta dell'utente** = Sì.

| Categoria Google Play | Dato | Note |
|---|---|---|
| Personal info | Name, Email address, Phone number, Address | Anagrafica cliente (anche da "Accedi con Google/Apple": nome ed email) |
| Personal info | Other info (codice fiscale, data di nascita) | Richiesti per prenotare |
| Photos and videos | Photos, Videos | Foto dei pet caricate dal cliente; foto/video dei pet inviati dallo staff |
| Files and docs | Files and docs | Documento d'identità (fronte/retro), liberatoria |
| Messages | Other in-app messages | Chat con assistenza/chatbot. L'AI (Anthropic) elabora i messaggi per nostro conto: per Google è un "fornitore di servizi", non condivisione con terzi |
| App activity | Other user-generated content | Prenotazioni, dati dei pet, note |

Non dichiarare: posizione (l'indirizzo lo scrive l'utente → è Personal info), dati
finanziari (nessun pagamento in app), ID dispositivo (le notifiche push su Android non
sono attive), dati sanitari (le vaccinazioni sono del pet, non della persona).

Domande generali del form:
- **Tutti i dati sono crittografati in transito?** Sì (HTTPS/TLS, Supabase).
- **L'app segue una policy per la richiesta di cancellazione dati?** Sì → in-app
  Impostazioni → Elimina account (cancellazione immediata, come già dichiarato ad Apple).
- **URL per l'eliminazione dell'account** (obbligatorio): `https://app.tenutadelbarone.com/elimina-account`
  — pagina pubblica, spiega come eliminare l'account dall'app o via email. ⚠️ Deve essere
  online sul sito vero prima di compilare il modulo.
- **Questo dato è condiviso con terze parti?** No per tutte le voci.
- **Uso pubblicitario/tracking?** No — nessun SDK ads, nessun tracking cross-app.

---

## 6. Content rating (questionario IARC)

Rispondi **"No" / "Nessuno"** a tutte le voci (violenza, contenuti sessuali, sostanze,
gioco d'azzardo, linguaggio scurrile, contenuti generati da utenti visibili pubblicamente).
Risultato atteso: **PEGI 3 / Everyone**, stesso esito già ottenuto su Apple (4+).

**Target audience**: dichiara "non rivolta principalmente ai bambini" (target 18+ o
general audience senza contenuti per bambini) — l'app richiede account cliente adulto.

---

## 7. Altri campi della scheda

- **Categoria**: Stile di vita (alternativa: Strumenti).
- **Tag**: pensione, cani, gatti, asilo, addestramento, animali, prenotazioni.
- **Prezzo**: Gratis.
- **Contiene annunci**: No.
- **Acquisti in-app**: No — dichiara "Nessun acquisto in-app" (i pagamenti riguardano solo
  servizi reali resi in struttura — pensione, addestramento — coerente con l'esenzione già
  usata su Apple; Stripe/pagamenti sono disabilitati in produzione).
- **Accesso alle app / account demo per la review** (Contenuti dell'app → Accesso alle app):
  **obbligatorio in pratica**, l'app è inutilizzabile senza login. Inserisci email e
  password di un cliente demo con pet e almeno una prenotazione. Non usare Google: finché
  la schermata di consenso Google è in modalità "Test" i revisori non possono accedere.

---

## 8. Cosa NON è ancora implementato su Android (da non promettere in scheda)

- Accedi con Apple: solo iOS (su Android c'è solo Google, nativo dalla 1.0.1).
- Fotocamera nativa: gated solo iOS (`lib/native/camera.ts`, `isIosApp()`); su Android il
  form foto usa `<input type="file">` (selettore di sistema): funziona, niente permessi.
- Push notifiche: solo iOS (APNs). Su Android servono FCM + `google-services.json`, vedi
  `docs/google-play-runbook.md`.
