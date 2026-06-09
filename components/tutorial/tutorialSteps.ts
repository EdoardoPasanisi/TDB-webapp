export type TutorialScene =
  | 'intro'
  | 'profile'
  | 'dog'
  | 'services'
  | 'calendar'
  | 'settings'
  | 'chat'
  | 'outro';

export type TutorialStep = {
  id: string;
  /** Schermata mock da mostrare sotto l'overlay. */
  scene: TutorialScene;
  /** `data-spot` dell'elemento da illuminare dentro la scena. Assente = card centrata. */
  spot?: string;
  title: string;
  body: string;
  /** Etichetta opzionale (chip) mostrata sopra il titolo. */
  chip?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'intro',
    scene: 'intro',
    chip: 'Benvenuto',
    title: 'Ti facciamo fare un giro 👋',
    body: 'In meno di un minuto ti mostriamo come funziona l’app: profilo, cani, prenotazioni, calendario e chat. Puoi saltare quando vuoi e rivederlo dalle Impostazioni.',
  },

  // --- PROFILO ---
  {
    id: 'profile-account',
    scene: 'profile',
    spot: 'account',
    chip: 'Profilo',
    title: 'I tuoi dati personali',
    body: 'Qui trovi il tuo profilo: nome, contatti, documento d’identità e liberatoria. Tieni questi dati aggiornati: ci servono per gestire le prenotazioni.',
  },
  {
    id: 'profile-address',
    scene: 'profile',
    spot: 'address',
    chip: 'Profilo',
    title: 'Indirizzo e contatti',
    body: 'L’indirizzo e il telefono vengono usati durante le prenotazioni (ad esempio per il servizio taxi o per contattarti). Compilali una volta e li ritrovi pronti.',
  },
  {
    id: 'profile-dogs',
    scene: 'profile',
    spot: 'dogs',
    chip: 'Profilo',
    title: 'I tuoi cani',
    body: 'Aggiungi qui i tuoi cani. Per ognuno potrai inserire le informazioni e aprire la sua scheda. Tocca “+ Aggiungi” per crearne uno.',
  },

  // --- SCHEDA CANE ---
  {
    id: 'dog-info',
    scene: 'dog',
    spot: 'dog-info',
    chip: 'Scheda cane',
    title: 'Le informazioni del cane',
    body: 'Razza, taglia, microchip, data di nascita, carattere e note. Più sono complete, meglio possiamo prenderci cura del tuo cane durante i servizi.',
  },
  {
    id: 'dog-card',
    scene: 'dog',
    spot: 'dog-card',
    chip: 'Scheda cane',
    title: 'La scheda pubblica',
    body: 'Ogni cane ha una scheda pubblica condivisibile. Decidi tu quali informazioni mostrare: bastano pochi tocchi per attivare o nascondere ogni dato.',
  },
  {
    id: 'dog-qr',
    scene: 'dog',
    spot: 'dog-qr',
    chip: 'Scheda cane',
    title: 'Il QR da condividere',
    body: 'Ogni scheda ha un QR code: chi lo scansiona (o riceve il link) vede subito la scheda pubblica del cane. Comodo per il dog sitter, il veterinario o in caso di smarrimento.',
  },

  // --- SERVIZI ---
  {
    id: 'services',
    scene: 'services',
    spot: 'services-grid',
    chip: 'Prenotazioni',
    title: 'Prenota un servizio',
    body: 'Da qui prenoti Pensione, Asilo, Addestramento e Consulenza. Scegli il servizio, segui i passaggi, indica le date e il tuo cane: ti guidiamo fino alla conferma.',
  },

  // --- CALENDARIO ---
  {
    id: 'calendar-grid',
    scene: 'calendar',
    spot: 'calendar-grid',
    chip: 'Calendario',
    title: 'Il tuo calendario',
    body: 'Nel calendario vedi a colpo d’occhio i giorni con prenotazioni. Tocca un giorno per vedere i dettagli dei servizi prenotati.',
  },
  {
    id: 'calendar-list',
    scene: 'calendar',
    spot: 'calendar-list',
    chip: 'Calendario',
    title: 'Prossime prenotazioni e saldo',
    body: 'Sotto al calendario trovi l’elenco delle prossime prenotazioni e il saldo da pagare. Tutto sempre sotto controllo.',
  },

  // --- IMPOSTAZIONI ---
  {
    id: 'settings',
    scene: 'settings',
    spot: 'settings-list',
    chip: 'Impostazioni',
    title: 'Impostazioni',
    body: 'Qui gestisci account, documenti, password e le preferenze di notifica. Da qui puoi anche rivedere questo tutorial quando vuoi.',
  },

  // --- CHAT ---
  {
    id: 'chat',
    scene: 'chat',
    spot: 'chat-area',
    chip: 'Assistenza',
    title: 'La chat',
    body: 'Hai una domanda? Scrivici dalla chat: ti rispondiamo qui dentro. È il modo più veloce per ricevere assistenza.',
  },

  {
    id: 'outro',
    scene: 'outro',
    chip: 'Tutto qui!',
    title: 'Sei pronto 🐾',
    body: 'Ora conosci le funzioni principali. Inizia completando il tuo profilo e aggiungendo il tuo primo cane. Buona permanenza alla Tenuta del Barone!',
  },
];
