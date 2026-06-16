# Gestionale — gestione completa utenti/cani/prenotazioni + modifica completa

> Guida per una **nuova sessione di Claude Code**. Obiettivo: rendere il gestionale
> in grado di fare **tutto** ciò che l'utente fa dall'app (con priorità sull'utente),
> così anche chi non sa usare l'app può usufruire dei servizi tramite lo staff.

## 0. Stato di partenza

- Lavorare su un **nuovo branch** partendo da `main` aggiornato (es. `feat/gestionale-full-management`).
- Il branch precedente `feat/app-improvements` contiene già: occhio password, Meticcio + razze d'origine + peso cane, storico prenotazioni, login social, intervallo servizi "Tutti", pulsanti stato completi su ogni card, saldo nell'elenco utenti, visibilità servizi (default da-erogare + toggle annullate/passate + "24h spento"), calendario solo confermate/pagate, "Pagata" che scala il saldo, **Elimina prenotazione con storno**. Verificare che sia mergiato in `main` prima di iniziare.
- **Migrazione DB già applicata**: `20260615_dog_weight_and_origin_breeds.sql` (dogs: `weight_kg`, `origin_breeds`, `show_weight`, `show_origin_breeds`).
- Verifiche obbligatorie ad ogni step: `npx tsc --noEmit`, `npx eslint <file toccati>`, `npm run build`.

## 1. Mappa architetturale (agganci utili)

**Gestionale (single page a tab):** `app/admin/page.tsx` → tab in `components/admin/tabs/`:
`ServicesTab.tsx`, `UsersTab.tsx`, `DogsTab.tsx`, `ConfigTab.tsx`, `OverviewTab.tsx`, `MediaTab.tsx`.
Modali condivisi: `components/admin/modals.tsx` (`UserDetailModal`, `DogDetailModal`, `BookingDetailModal`).
Helper UI admin: `components/admin/shared.tsx` (`nextStatuses`, `statusTone`, `formatAccommodationTypeLabel`, `TimelineCard`, `ModalFrame`, `DetailSection`, ...).

**Accesso admin:** `lib/admin/auth.ts` → `requireStaffAccess(request, 'view'|'manage')`; `canManage = role === 'ADMIN'`. Gating route in `proxy.ts` (`/admin` controlla `staff_accounts` per `user_id`). Le operazioni admin usano `supabaseAdmin` (service role, **bypassa RLS**).

**Data layer admin:** `lib/admin/data.ts` — funzioni esistenti chiave:
`searchAdminUsers`, `getAdminUserDetail`, `updateAdminBookingStatus`, `deleteAdminBooking`,
`unlockAdminServicePass`, `upsertAdminSlot`, `loadActiveBookingCountsForUsers`.
Tipi: `lib/admin/types.ts` (`AdminUserListItem` — ora ha `walletDue` —, `AdminUserDetail`, `AdminAgendaItem`, `AdminBookingKind`, `AdminServiceKey`).
Validazione/sanitize: `lib/admin/validation.ts` (`sanitizeDogInput`, `sanitizeDogCardVisibilityPatch`, `sanitizeBookingStatusPatchInput`, `sanitizeSlotInput`, `assertUuid`).

**Rotte API admin:** `app/api/admin/...`
`users/route.ts`, `users/[userId]/route.ts`, `users/[userId]/settle/route.ts`,
`users/[userId]/passes/[passId]/unlock/route.ts`, `bookings/[kind]/[bookingId]/route.ts` (GET/PATCH/DELETE), `dogs/...`, `slots/...`, `documents/...`.

**Flussi lato utente da rispecchiare nel gestionale:**
- Profilo/account: tabella `profiles`; UI in `app/account/*`; preferenze scheda in `lib/account/profileApi.ts` (`updateProfileCardPreferencesForCurrentUser`).
- Cani: `components/dogs/DogForm.tsx`; API `app/api/dogs/route.ts` (POST), `app/api/dogs/[dogId]/route.ts` (PATCH/DELETE), `app/api/dogs/[dogId]/visibility/route.ts`; client `lib/dogs/dogApi.ts`. La size viene **sovrascritta server-side** dalla razza (`findDogBreed`).
- Pensione: API `app/api/pensione-bookings/route.ts` (POST gestisce **create + edit** con `bookingId`, stati editabili in `EDITABLE_STATUSES`). Pricing in `lib/services/pensione/utils.ts` (`computePricing`, `computePerDogTotals`, `buildExtrasPayload`), costanti `lib/services/pensione/constants.ts` (`ACCOMMODATION_PRICES`, `EXTRA_PRICES`).
- Slot (asilo/addestramento/consulenza a crediti): RPC `book_service_slot` (crea `CONFIRMED`, consuma credito); taxi aggiunto al wallet in `components/services/FissaDataModal.tsx` (`addToWalletDueEur`).
- Acquisto pacchetti/crediti: RPC `purchase_service_pass` (wallet += prezzo; pacchetti multi-credito nascono `LOCKED` finché lo staff non conferma il pagamento).

## 2. Modello SOLDI / wallet (CRITICO — leggere bene)

- `profiles.wallet_due_eur` = **saldo dovuto** (registro incrementale, non calcolato).
- RPC: `add_wallet_due(p_user_id uuid, p_amount_eur numeric)` (admin) e `add_wallet_due(p_amount_eur)` (utente corrente). `greatest(0, ...)`.
- RPC `settle_user_wallet(p_user_id, p_amount_eur, p_staff_id)` → azzera il saldo, scrive riga in `payments` (analisi entrate), **sblocca i pass `LOCKED` → `ACTIVE`**. Già usata da `app/api/admin/users/[userId]/settle`.
- "Debito in sospeso" = stati `CONFIRMED`/`COMPLETED` (helper `isOutstandingBalanceStatus` in `lib/admin/data.ts`). `PAID`/`CANCELLED` = fuori dal saldo. NON confondere con `isConfirmedRevenueStatus` (usato per le ENTRATE/analytics, include `PAID`).
- Pensione: alla **conferma** il totale entra nel saldo; a **PAID/annullo** esce (logica in `updateAdminBookingStatus`, oggi **solo pensione**).
- Pacchetti: prezzo entra nel saldo all'acquisto. Usare un credito NON tocca il saldo.

### ⚠️ Gap noti da sistemare insieme alle nuove feature
1. **Annullo admin di uno SLOT non rimborsa i crediti.** Oggi `updateAdminBookingStatus` per gli slot cambia solo lo stato; il rimborso credito esiste solo nell'RPC utente `cancel_service_slot_booking`. Quando si fa la modifica/annullo/elimina admin va gestito il rimborso credito (+ taxi). NB: `deleteAdminBooking` (già fatto) **rimborsa** crediti+taxi: usarlo come riferimento.
2. Creare un utente da admin = creare una riga in `auth.users` (via `supabaseAdmin.auth.admin.createUser`) → il trigger `handle_new_user` crea da sé la riga `profiles`. Poi aggiornare il profilo. Valutare invito email vs creazione con password temporanea.

## 3. Feature da implementare

### 3.1 Modifica COMPLETA delle prenotazioni (admin)
Per **ogni** prenotazione, dal `BookingDetailModal` (o pagina dedicata) un pulsante **"Modifica"** che permette edit completo.

- **Pensione**: modificare date, cani, alloggio (incl. nuovo `HOTEL`), extra (ricerca olfattiva/fitness/passeggiata/trekking, toelettatura, vaccino, terapia), taxi, note. **Ricalcolare il prezzo** con `computePricing`/`computePerDogTotals` e **riconciliare il saldo**: se la prenotazione era a saldo (CONFIRMED/COMPLETED), applicare al wallet la **differenza** (nuovo_totale − vecchio_totale) via `add_wallet_due(user_id, delta)`. Riusare il più possibile la logica di `app/api/pensione-bookings/route.ts` creando un endpoint admin equivalente (`app/api/admin/bookings/pensione/[bookingId]` PATCH "full") che operi su qualsiasi `user_id`.
- **Slot**: modificare slot/data, cane/i, taxi, note, con controllo capienza (vedi `book_service_slot`); gestire eventuale rimborso/riaddebito credito e taxi.
- Mostrare a video la differenza di saldo prima di confermare.

### 3.2 Gestione COMPLETA del profilo utente da gestionale (priorità sull'utente)
Tutto ciò che l'utente fa dall'app deve essere fattibile dallo staff su **qualsiasi** cliente:
- **Creare** un utente (auth + profilo) — vedi §2 gap 2.
- **Eliminare** un utente (con cosa fare di cani/prenotazioni/storage: definire — soft delete consigliato).
- **Modificare** tutti i dati profilo (anagrafica, indirizzi, indirizzo servizi, documenti, preferenze scheda pubblica).
- **Cani**: aggiungere / rimuovere / modificare (riusare `DogForm` + `sanitizeDogInput`; size derivata dalla razza).
- **Prenotazioni**: creare / modificare / eliminare / cambiare stato (già in parte presente).
- **Crediti/pacchetti**: assegnare/acquistare per conto del cliente, sbloccare (`unlockAdminServicePass` esiste), eventualmente rimuovere.

### 3.3 Pagina Utenti (riorganizzazione `UsersTab`)
- **Default**: mostrare la **lista di tutti gli utenti in ordine alfabetico** (oggi è vuota finché non si cerca — `searchAdminUsers` con termine vuoto già ordina per `last_name`, ma la UI mostra `hasQuery ? items : null`: cambiare per mostrare sempre la lista).
- Pulsante **"Prenotazioni attive"** che filtra ai soli utenti con prenotazioni attive (c'è già `loadActiveBookingCountsForUsers` / `item.activeBookings`).
- La **ricerca** continua a funzionare come ora.
- Click su cliente → dettaglio con **le stesse info di adesso ma il SALDO in cima**, e un pulsante **"Modifica informazioni"** che apre l'editing completo di tutte le info utente **inclusi i cani**.

### 3.4 Pagina Cani (`DogsTab`)
- **Default**: tutti i cani in **ordine alfabetico**.
- Click su un cane → modificarne le info (riusare `DogForm`).

## 4. Note implementative / gotchas

- Riusare componenti utente esistenti dove possibile (`DogForm`, form pensione) passando un "contesto admin" + un `userId` target, invece di duplicare la UI.
- Tutte le scritture admin via `supabaseAdmin` + `requireStaffAccess(request, 'manage')`. Le letture possono usare `view`.
- Validare sempre input lato server (pattern in `lib/admin/validation.ts`).
- `AdminUserListItem` ha già `walletDue`. La redazione per ruolo `VIEWER` è in `sanitizeUserListItemVisibility` (azzera campi sensibili).
- Notifiche utente: cambi di stato già creano notifica (`createUserNotificationIfEnabled`); valutare notifiche anche per modifiche fatte dallo staff.
- Attenzione a non rompere i flussi utente esistenti (le stesse funzioni di pricing sono condivise).

## 5. DB / Supabase

- Probabile **nessuna nuova migrazione** se si riusano colonne/RPC esistenti. Se serve un `deleted_at` su `profiles` per il soft-delete utente, fare **una sola** migrazione idempotente (`alter table ... add column if not exists ...`) e documentarla qui.
- Provider OAuth Google/Apple già configurati su Supabase (login social). Il secret Apple **scade ~dicembre 2026** → rigenerare (vedi storico chat: script Node ES256 con Team ID `S65U82HY9X`, Services ID `app.tenutadelbarone.signin`, nuova Key da creare).

## 5.1 Migrazione applicata da questa sessione

- **`supabase/migrations/20260616_profile_soft_delete.sql`** (idempotente): aggiunge
  `profiles.deleted_at timestamptz` + indice. Serve al soft-delete utenti.
  - Soft-delete = `deleted_at = now()` + ban auth (`ban_duration`) per impedire l'accesso.
  - Ripristino = `deleted_at = null` + unban.
  - Hard-delete (solo su utenti già soft-deleted, dalla pagina "Eliminati"): rimuove
    auth.users + dati collegati + file documenti (`lib/admin/management.ts → hardDeleteAdminUser`).

### Cosa è stato implementato (sintesi)

- **Decisioni**: creazione utente con **password temporanea** (mostrata allo staff);
  eliminazione utente **soft-delete** + tab **Eliminati** con ripristino/eliminazione definitiva.
- **Backend**: `lib/admin/management.ts` (create/soft/restore/hard-delete utente, create/delete
  cane con size da razza, assegna/annulla pacchetto, **edit completo pensione** con riconciliazione
  saldo, **edit slot** con controllo capienza, **stato slot con rimborso/riaddebito crediti+taxi** →
  fix gap §2.1). Parser pensione condiviso in `lib/services/pensione/parseInput.ts` (riusato
  da rotta utente e admin). Validatori in `lib/admin/validation.ts`.
- **Rotte**: `users` POST + `?status=deleted`; `users/[userId]` DELETE; `users/[userId]/restore`;
  `users/[userId]/hard-delete`; `users/[userId]/passes` (POST) + `[passId]` (DELETE); `dogs` POST +
  `dogs/[dogId]` DELETE; `products` GET; `bookings/[kind]/[bookingId]/full` PATCH.
- **UI**: `UsersTab` (lista alfabetica di default, tab Tutti/Prenotazioni attive/Eliminati, saldo in
  cima, "Modifica informazioni", gestione cani e crediti, crea/elimina utente), `DogsTab` (lista
  alfabetica di default), `BookingDetailModal` con "Modifica" → `BookingEditModal` (pensione+slot,
  anteprima variazione saldo). Nuovi componenti: `CreateUserModal`, `DogEditModal`, `AssignPassModal`,
  `BookingEditModal`.

## 5.2 Ruoli staff, conferme e sicurezza (sessione successiva)

- **Migrazione `supabase/migrations/20260617_super_admin_role.sql`** (idempotente):
  - Aggiunge il ruolo **`SUPER_ADMIN`** ("Amministratore plus") al CHECK di `staff_accounts`.
  - Aggiorna le policy RLS chat per riconoscere ADMIN **e** SUPER_ADMIN.
  - Crea la vista **`staff_members_directory`** (`role, is_active, email, first_name, last_name, …`)
    per vedere dal DB **chi sono i membri staff** (email + nome).
  - ⚠️ **Bootstrap**: il primo Amministratore plus va impostato a mano in DB
    (`update public.staff_accounts set role='SUPER_ADMIN' where user_id='<uuid>';`).
    Dopo, è lui a gestire gli altri dal gestionale.
- **Ruoli**: `SUPER_ADMIN` (poteri completi **+ gestione di tutti gli staff, admin inclusi**),
  `ADMIN` (poteri completi; può aggiungere/rimuovere solo membri **Sola lettura**, non altri
  admin né il super), `VIEWER` (sola lettura).
  - Rotte staff: `requireStaffAccess(req, 'manage')` + controllo ruolo lato server — un ADMIN può
    agire solo su target `VIEWER`; assegnare/modificare ADMIN/SUPER richiede `canManageStaff`.
  - In Config la card "Staff" è visibile a tutti i manager; per un ADMIN il menu ruoli mostra solo
    "Sola lettura" e i membri admin/super non sono modificabili. Nessuno può modificare sé stesso.
- **Poteri VIEWER (sola lettura)**: vede liste/dettagli con PII oscurata (no email/telefono/indirizzi/
  CF/documenti), MA **vede saldo, pacchetti/crediti e "dati mancanti" di utente e cane**
  (i mancanti del proprietario sono calcolati server-side su dati reali → `AdminUserDetail.ownerMissing`,
  così restano accurati senza esporre i valori). Non può creare/modificare/eliminare nulla.
- **VIEWER e pagina Config**: non accessibile (tab nascosto e `ConfigTab` esce se `!canManage`).
- **Conferme esplicite** (`components/admin/ConfirmProvider.tsx`, `useConfirm`): ogni azione
  **Elimina** richiede di digitare `ELIMINA`, ogni **Modifica** di digitare `MODIFICA`. Applicate a:
  elimina/modifica prenotazione, elimina/modifica cane, modifica profilo cliente, elimina cliente
  (soft) ed eliminazione definitiva, annulla pacchetto, elimina slot, rimuovi accesso staff.

## 6. Checklist finale
- [ ] tsc/eslint/build verdi
- [ ] Flussi utente esistenti non regrediti
- [ ] Saldo riconciliato correttamente su create/edit/delete/cancel (pensione **e** slot, crediti+taxi)
- [ ] Lista utenti e cani alfabetiche di default; "Prenotazioni attive" funzionante
- [ ] Saldo in cima al dettaglio utente; "Modifica informazioni" completo (cani inclusi)
- [ ] Creazione/eliminazione utente da admin testata
- [ ] Eventuale migrazione DB documentata e idempotente
