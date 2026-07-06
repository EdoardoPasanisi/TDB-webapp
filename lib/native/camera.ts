// Fotocamera NATIVA (Capacitor) come funzione dell'app iOS.
//
// Nei browser questo modulo non viene mai eseguito: l'UI continua a usare
// l'`<input type="file">` classico. Nell'app iOS invece apriamo la fotocamera/
// galleria native, così l'app ha una capability nativa reale (difesa contro la
// App Store Guideline 4.2 "è solo un sito").
//
// Ritorna un `File` che entra nella STESSA pipeline di upload del browser
// (compressione + upload Supabase): a valle non cambia nulla.

import { isIosApp } from './platform';

/**
 * Apre la fotocamera/galleria native e ritorna un File pronto per l'upload.
 * Ritorna `null` se non siamo nell'app iOS o se l'utente annulla.
 */
export async function pickPhotoNative(): Promise<File | null> {
  if (!(await isIosApp())) return null;

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt, // iOS chiede "Scatta foto" oppure "Libreria"
      presentationStyle: 'popover',
    });

    if (!photo?.webPath) return null;

    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const format = (photo.format || 'jpeg').toLowerCase();
    const ext = format === 'jpg' ? 'jpeg' : format;
    const type = blob.type || `image/${ext}`;
    return new File([blob], `photo-${Date.now()}.${ext}`, { type });
  } catch (error) {
    // L'annullamento da parte dell'utente non è un errore.
    const message = String((error as Error)?.message ?? '').toLowerCase();
    if (message.includes('cancel')) return null;
    throw error;
  }
}
