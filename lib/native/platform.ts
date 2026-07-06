// Rilevamento del contesto di esecuzione (browser vs app nativa) e della
// piattaforma nativa (ios / android).
//
// Serve a far girare le funzioni native SOLO dove devono:
//  - il codice Apple-specifico (push APNs) è gated a `ios` — mai su Android né browser;
//  - nessun modulo Capacitor viene mai importato/eseguito in un browser, perché
//    l'import di `@capacitor/core` è dinamico e avviene solo lato client.
//
// La distinzione ios/android NON si basa sulla classe `.native-app` (condivisa dalle
// due app), ma sul platform runtime esposto dal bridge nativo di Capacitor.

export type NativePlatform = 'ios' | 'android' | 'web';

let cached: NativePlatform | undefined;

export async function getNativePlatform(): Promise<NativePlatform> {
  if (cached) return cached;
  if (typeof window === 'undefined') return 'web';
  try {
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    cached = platform === 'ios' || platform === 'android' ? platform : 'web';
  } catch {
    cached = 'web';
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
