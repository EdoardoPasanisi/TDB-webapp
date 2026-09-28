// Rilevamento del contesto di esecuzione (browser vs app nativa) e della
// piattaforma nativa (ios / android).
//
// Serve a far girare le funzioni native SOLO dove devono:
//  - il codice Apple-specifico (push APNs) è gated a `ios` — mai su Android né browser;
//  - nessun modulo Capacitor viene mai importato/eseguito in un browser, perché
//    l'import di `@capacitor/core` è dinamico e avviene solo lato client.
//
// La distinzione ios/android usa il platform runtime esposto dal bridge nativo di
// Capacitor, con lo user-agent del guscio come rete di sicurezza (vedi sotto).

export type NativePlatform = 'ios' | 'android' | 'web';

let cached: NativePlatform | undefined;

// Il guscio nativo aggiunge 'TDBApp' allo user-agent (capacitor.config.ts →
// appendUserAgent): è la fonte più affidabile per sapere SE siamo nell'app, perché
// c'è dal primo byte della pagina. `Capacitor.getPlatform()` invece dipende dal bridge
// iniettato dal guscio: se `@capacitor/core` viene valutato prima che il bridge sia
// pronto (capitava su Android) risponde 'web', e quel 'web' finiva in cache per tutta
// la sessione → pulsanti social visibili "a volte" e flusso OAuth web dentro l'app.
function platformFromUserAgent(): NativePlatform {
  const ua = navigator.userAgent;
  if (ua.indexOf('TDBApp') === -1) return 'web';
  return /Android/i.test(ua) ? 'android' : 'ios';
}

export async function getNativePlatform(): Promise<NativePlatform> {
  if (cached) return cached;
  if (typeof window === 'undefined') return 'web';
  const fromUserAgent = platformFromUserAgent();
  // Nei browser lo user-agent non contiene mai 'TDBApp': niente Capacitor da caricare.
  if (fromUserAgent === 'web') {
    cached = 'web';
    return cached;
  }
  try {
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    cached = platform === 'ios' || platform === 'android' ? platform : fromUserAgent;
  } catch {
    cached = fromUserAgent;
  }
  return cached;
}

/** True dentro l'app nativa (iOS o Android). Mai true in un browser. */
export async function isNativeApp(): Promise<boolean> {
  return (await getNativePlatform()) !== 'web';
}

/** True solo dentro l'app iOS. Usato per gating del codice Apple-specifico. */
export async function isIosApp(): Promise<boolean> {
  return (await getNativePlatform()) === 'ios';
}
