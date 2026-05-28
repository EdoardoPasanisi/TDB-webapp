const MB = 1024 * 1024;

export const MAX_DOG_PHOTO_BYTES = 5 * MB;
export const MAX_PROFILE_PHOTO_BYTES = 5 * MB;
export const MAX_USER_DOCUMENT_BYTES = 10 * MB;
export const MAX_CUSTOMER_MEDIA_BYTES = 50 * MB;

export const DOG_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const PROFILE_PHOTO_MIME_TYPES = new Set(DOG_PHOTO_MIME_TYPES);

export const USER_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const CUSTOMER_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

type ValidateFileArgs = {
  file: File;
  allowedMimeTypes: Set<string>;
  maxBytes: number;
  invalidTypeMessage: string;
  tooLargeMessage: string;
};

export function validateUploadFile(args: ValidateFileArgs): string | null {
  const { file, allowedMimeTypes, maxBytes, invalidTypeMessage, tooLargeMessage } = args;

  if (file.size <= 0) {
    return 'Il file selezionato è vuoto.';
  }

  if (file.size > maxBytes) {
    return tooLargeMessage;
  }

  const mimeType = String(file.type ?? '').trim().toLowerCase();
  if (!allowedMimeTypes.has(mimeType)) {
    return invalidTypeMessage;
  }

  return null;
}

export function validateUploadBytes(file: File, bytes: Uint8Array): string | null {
  const mimeType = String(file.type ?? '').trim().toLowerCase();

  if (mimeType === 'application/pdf') {
    return hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
      ? null
      : 'Il file PDF non è valido.';
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff]) ? null : 'Il file JPG non è valido.';
  }

  if (mimeType === 'image/png') {
    return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ? null
      : 'Il file PNG non è valido.';
  }

  if (mimeType === 'image/webp') {
    return hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WEBP')
      ? null
      : 'Il file WebP non è valido.';
  }

  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    return hasAscii(bytes, 4, 'ftyp') ? null : 'Il file video non è valido.';
  }

  if (mimeType === 'video/webm') {
    return hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3]) ? null : 'Il file WebM non è valido.';
  }

  return null;
}

function hasPrefix(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function hasAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;

  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }

  return true;
}
