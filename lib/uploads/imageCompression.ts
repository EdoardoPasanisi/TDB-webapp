'use client';

// Ridimensiona/ricomprime un'immagine PRIMA dell'upload. Le foto scattate dai
// telefoni pesano spesso 3-8MB: senza questo passaggio sfondano il limite del
// corpo richiesta delle serverless (~4,5MB) e generano "errori strani" lato utente.
// I file non-immagine (PDF) vengono restituiti invariati. In caso di qualsiasi
// problema di decodifica (es. HEIC non supportato dal canvas) torniamo al file
// originale: meglio un upload pieno che un fallimento.

type CompressOptions = {
  maxDimension?: number; // lato lungo massimo in px
  quality?: number; // 0..1, qualità JPEG
};

const DEFAULT_MAX_DIMENSION = 2200;
const DEFAULT_QUALITY = 0.82;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-decode-failed'));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;
  if (!file.type.startsWith('image/')) return file;

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) return file;

    const longSide = Math.max(width, height);
    const scale = longSide > maxDimension ? maxDimension / longSide : 1;
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!blob) return file;

    // Se la ricompressione non ha ridotto la dimensione (immagine già piccola),
    // teniamo l'originale per non perderne inutilmente qualità.
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'documento';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
