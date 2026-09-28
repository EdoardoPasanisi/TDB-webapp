'use client';

// Tasto / gesto "indietro" di Android dentro l'app.
//
// Senza un listener Capacitor non gestisce il back: Android chiude l'activity e l'app
// si chiude a ogni "indietro", anche a metà di una prenotazione. Qui lo facciamo
// comportare come in un'app nativa: si torna alla schermata precedente e, quando non
// c'è più storia, l'app va in background (come il back sulla home di un'app nativa).
//
// Non renderizza nulla. Nel browser e su iOS (che non ha un tasto back di sistema)
// è un no-op: `@capacitor/app` viene importato solo nel guscio Android.

import { useEffect } from 'react';
import { getNativePlatform } from '@/lib/native/platform';

export function NativeBackButton() {
  useEffect(() => {
    let removed = false;
    let remove: (() => void) | undefined;

    void (async () => {
      if ((await getNativePlatform()) !== 'android') return;
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          void App.minimizeApp();
        }
      });
      if (removed) void handle.remove();
      else remove = () => void handle.remove();
    })();

    return () => {
      removed = true;
      remove?.();
    };
  }, []);

  return null;
}
