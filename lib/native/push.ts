// Registrazione push APNs — SOLO app iOS.
//
// APNs è il servizio push di Apple: questo codice è quindi Apple-specifico e viene
// eseguito unicamente quando `getNativePlatform() === 'ios'`. Su Android (che userebbe
// FCM, non incluso) e nei browser non fa assolutamente nulla — il modulo
// `@capacitor/push-notifications` non viene nemmeno importato.
//
// Flusso: chiedi permesso → `register()` → alla `registration` arriva il device token
// APNs, che inviamo al backend (`/api/push/register`) con il bearer della sessione.

import { getNativePlatform } from './platform';

let started = false;

/**
 * Avvia (una sola volta per sessione app) la registrazione push su iOS.
 * `getAccessToken` fornisce il token di sessione Supabase per autenticare la
 * chiamata al backend al momento in cui arriva il device token.
 */
export async function registerIosPush(getAccessToken: () => Promise<string | null>): Promise<void> {
  if (started) return;
  if ((await getNativePlatform()) !== 'ios') return;
  started = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Device token APNs pronto → invialo al backend.
    await PushNotifications.addListener('registration', async (token) => {
      try {
        const accessToken = await getAccessToken();
        await fetch('/api/push/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ token: token.value, platform: 'ios' }),
        });
      } catch {
        // Silenzioso: riproveremo al prossimo avvio dell'app.
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('APNs registration error:', error);
      started = false; // consente un nuovo tentativo
    });

    // Tap dell'utente su una notifica → naviga all'href se presente nel payload.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const href = action.notification?.data?.href;
      if (typeof href === 'string' && href) {
        window.location.assign(href);
      }
    });

    const status = await PushNotifications.checkPermissions();
    let receive = status.receive;
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      receive = (await PushNotifications.requestPermissions()).receive;
    }
    if (receive !== 'granted') {
      started = false;
      return;
    }

    await PushNotifications.register();
  } catch (error) {
    console.error('APNs setup failed:', error);
    started = false;
  }
}
