# Recap interventi media clienti

Documento di recap sul lavoro fatto per il flusso media staff -> cliente.

## Obiettivo

Permettere allo staff di inviare foto e video ai clienti durante le pensioni attive, evitando errori di upload e rendendo i video riproducibili nella sezione "I miei media" del profilo cliente.

## Problemi affrontati

1. Lo staff non riusciva a inviare media.
2. I video iPhone caricati dal file picker erano molto grandi.
3. Serviva una registrazione video direttamente dall'app con qualita ridotta.
4. La UI di registrazione doveva essere fullscreen e mostrare una preview prima dell'uso.
5. I video risultavano presenti e riproducibili su Supabase, ma lato cliente su iPhone/Safari venivano mostrati come video da `0:00`.

## Upload staff

E stato introdotto un flusso di upload firmato su Supabase Storage:

- lo staff chiede una signed upload URL a `/api/admin/media/upload-url`;
- il client carica direttamente sul bucket `customer-media` con `uploadToSignedUrl`;
- lo staff conferma l'upload con `/api/admin/media/complete`;
- il server verifica dimensione, MIME, firma del file e registra la riga in `customer_media`;
- viene creata una notifica cliente quando il media e disponibile.

File principali:

- `app/api/admin/media/upload-url/route.ts`
- `app/api/admin/media/complete/route.ts`
- `lib/media/server.ts`
- `lib/media/config.ts`
- `components/admin/tabs/MediaTab.tsx`

Commit:

- `f812cbb Fix staff media uploads`

## Bucket Supabase

E stata aggiunta la migration:

- `supabase/migrations/20260622000000_customer_media_bucket_limits.sql`

La migration allinea il bucket `customer-media` al flusso firmato:

- bucket privato;
- limite file: `52428800` byte, cioe 50MB;
- MIME ammessi: JPG, PNG, WebP, MP4, MOV, WebM.

Nota: Supabase Pro aumenta risorse/storage disponibili, ma non comprime i video. Per evitare file enormi serve registrare/comprimere prima dell'upload oppure introdurre un servizio di transcodifica.

## Registrazione video staff

E stata aggiunta la registrazione video direttamente dalla tab media staff.

Caratteristiche:

- durata massima: 120 secondi;
- target circa 720p;
- bitrate ridotto;
- preview prima di usare il video;
- il video scelto viene poi usato come file del draft media e inviato tramite il flusso firmato.

Commit:

- `96494ff Add in-app staff video recording`

## UI fullscreen e preview staff

La UI del recorder e stata aggiornata per funzionare meglio da mobile:

- durante la registrazione il video occupa tutto lo schermo;
- resta visibile solo il controllo per interrompere la registrazione;
- dopo lo stop viene mostrata una preview con le azioni "Registra di nuovo" e "Usa questo video";
- sono stati aggiunti fallback per preview su Safari/iPhone, inclusi MIME piu precisi e retry tramite Data URL.

Commit:

- `3ddbd41 Improve staff video recorder preview`
- `ca825e6 Improve staff video preview fallback`
- `711bd30 Retry staff video preview on Safari`

## Correzione playback lato cliente

Il problema finale non era la registrazione: il video risultava presente e riproducibile su Supabase. Il problema era la visualizzazione nella pagina profilo cliente.

Prima il profilo cliente usava direttamente il signed URL Supabase nel tag video:

```tsx
<video controls preload="metadata">
  <source src={item.signedUrl} />
</video>
```

Su iPhone/Safari questo poteva portare a durata `0:00 / 0:00`.

La fix finale introduce una route interna autenticata:

- `app/api/media/[mediaId]/content/route.ts`

La route:

- verifica che l'utente sia autenticato;
- verifica che il media appartenga all'utente;
- verifica che il media sia ancora visibile;
- crea un signed URL Supabase server-side;
- inoltra il file al browser;
- preserva gli header video importanti, in particolare `Range`, `Content-Range`, `Content-Length`, `Accept-Ranges`;
- imposta `Content-Type` in base all'estensione del file.

Il profilo cliente ora usa:

- `item.mediaUrl` per la sorgente;
- `item.mimeType` come tipo del source;
- `playsInline`;
- `preload="auto"`.

File modificati:

- `app/api/media/[mediaId]/content/route.ts`
- `app/profile/page.tsx`
- `lib/media/server.ts`
- `types/media.ts`

Commit:

- `e023592 Fix customer video playback streaming`

## Modifica scartata

Durante il debug era stata preparata una patch locale che cambiava il comportamento della registrazione su iPhone, usando la camera nativa invece di `MediaRecorder` e aggiungendo una validazione server sulla durata MP4.

Quella patch e stata scartata prima del commit finale, perche il video era gia valido su Supabase e il problema reale era la visualizzazione cliente.

Conferma finale prima del commit `e023592`:

- nessuna modifica residua in `components/admin/tabs/MediaTab.tsx`;
- commit finale limitato alla fix di streaming cliente/API.

## Stato attuale del flusso

1. Staff registra o seleziona un media.
2. Staff invia il media tramite signed upload su Supabase.
3. Server valida e registra il media in `customer_media`.
4. Cliente apre il profilo.
5. `/api/media` restituisce i media visibili.
6. Per le immagini viene usato il signed URL.
7. Per i video viene usata la route interna `/api/media/[mediaId]/content`.
8. Il browser riceve uno stream same-origin con header adatti a Safari/iPhone.

## Verifiche eseguite

Per le patch principali sono stati eseguiti:

- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`

Lint mostra ancora solo warning pre-esistenti:

- `app/auth/callback/route.ts`: variabile `userErr` non usata;
- `components/chat/UserChatPage.tsx`: dipendenza `load` mancante in alcuni `useEffect`.

## Note operative

- I video gia caricati e validi su Supabase dovrebbero usare automaticamente la nuova route dopo il deploy, perche il profilo cliente riceve `mediaUrl` calcolato dall'API.
- Se un file video fosse realmente corrotto a livello di container, la route non potrebbe ripararlo; andrebbe ricaricato.
- Il limite applicativo/bucket resta 50MB.
- Se in futuro servono video piu lunghi o nativi iPhone senza limiti stretti, serve decidere tra aumento del limite storage o transcodifica esterna/server-side.
