export type TutorialScene =
  | 'intro'
  | 'profile'
  | 'dog'
  | 'services'
  | 'calendar'
  | 'chat'
  | 'settings'
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
    body: 'In un minuto ti mostriamo come funziona l’app e dove trovare ogni cosa. Puoi saltare quando vuoi e rivedere il tutorial dalle Impostazioni.',
  },

  // --- PROFILO ---
  {
    id: 'open-profile',
    scene: 'services',
    spot: 'nav-profile',
    chip: 'Profilo',
    title: 'Apri il tuo profilo',
    body: 'Tocca l’icona del profilo per aprire la tua area personale: dati, documenti e i tuoi cani. È il primo posto da sistemare.',
  },
  {
    id: 'profile-account',
    scene: 'profile',
    spot: 'account',
    chip: 'Profilo',
    title: 'I tuoi dati personali',
    body: 'Qui trovi nome, contatti, documento d’identità e liberatoria. Tienili aggiornati: ci servono per gestire le prenotazioni.',
  },
  {
    id: 'profile-service-address',
    scene: 'profile',
    spot: 'service-address',
    chip: 'Profilo',
    title: 'Cos’è l’“indirizzo servizi”',
    body: 'È l’indirizzo dove ritiriamo e riportiamo il tuo cane per i servizi a domicilio (ad esempio il Taxi Dog). Può essere diverso dalla tua residenza: per questo lo gestisci a parte.',
  },
  {
    id: 'profile-dogs',
    scene: 'profile',
    spot: 'dogs',
    chip: 'Profilo',
    title: 'I tuoi cani',
    body: 'Aggiungi qui i tuoi cani con il pulsante “+ Aggiungi”. Per ognuno potrai inserire le informazioni e aprire la sua scheda.',
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
    body: 'Ogni scheda ha un QR code: chi lo scansiona (o riceve il link) vede subito la scheda pubblica del cane. Comodo da dare a amici o parenti che lo accudiscono, al veterinario o in caso di smarrimento.',
  },

  // --- SERVIZI ---
  {
    id: 'open-services',
    scene: 'services',
    spot: 'nav-home',
    chip: 'Servizi',
    title: 'Dove prenotare i servizi',
    body: 'Il pulsante centrale (o “Servizi” su computer) ti porta alla home dei servizi: è da qui che parte ogni prenotazione.',
  },
  {
    id: 'services-grid',
    scene: 'services',
    spot: 'services-grid',
    chip: 'Servizi',
    title: 'Prenota un servizio',
    body: 'Pensione, Asilo, Addestramento e Consulenza. Tocca un servizio, segui i passaggi guidati (date, cane, eventuali extra) e arrivi fino alla conferma.',
  },
  {
    id: 'services-credits',
    scene: 'services',
    spot: 'credits',
    chip: 'Crediti',
    title: 'I crediti dei servizi',
    body: 'Alcuni servizi si acquistano a pacchetti di crediti: ogni tessera mostra i crediti rimasti. Quando vuoi usarne uno, tocca la tessera e fissi la data della sessione, senza ripagare ogni volta.',
  },

  // --- CALENDARIO ---
  {
    id: 'open-calendar',
    scene: 'services',
    spot: 'nav-calendar',
    chip: 'Calendario',
    title: 'Dove vedere il calendario',
    body: 'Da “Calendario” trovi tutte le tue prenotazioni e il saldo da pagare.',
  },
  {
    id: 'calendar-grid',
    scene: 'calendar',
    spot: 'calendar-grid',
    chip: 'Calendario',
    title: 'I giorni prenotati',
    body: 'I giorni con un servizio sono evidenziati. Tocca un giorno per vederne i dettagli.',
  },
  {
    id: 'calendar-saldo',
    scene: 'calendar',
    spot: 'calendar-saldo',
    chip: 'Calendario',
    title: 'Prossime prenotazioni e saldo',
    body: 'Sotto al calendario trovi l’elenco delle prossime prenotazioni e, in alto a destra, il saldo ancora da pagare.',
  },

  // --- CHAT ---
  {
    id: 'chat',
    scene: 'chat',
    spot: 'nav-chat',
    chip: 'Assistenza',
    title: 'La chat di assistenza',
    body: 'La chat si apre da qui: scrivici per qualsiasi domanda e ti rispondiamo dentro l’app. È il modo più veloce per avere assistenza.',
  },

  // --- IMPOSTAZIONI ---
  {
    id: 'settings',
    scene: 'settings',
    spot: 'nav-settings',
    chip: 'Impostazioni',
    title: 'Le impostazioni',
    body: 'Le impostazioni si aprono da qui: account, documenti, password e notifiche. Da qui puoi anche rivedere questo tutorial quando vuoi.',
  },

  {
    id: 'outro',
    scene: 'outro',
    chip: 'Tutto qui!',
    title: 'Sei pronto 🐾',
    body: 'Ora sai dove trovare ogni cosa. Inizia completando il profilo e aggiungendo il tuo primo cane. Buona permanenza alla Tenuta del Barone!',
  },
];
