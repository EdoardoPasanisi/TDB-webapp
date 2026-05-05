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
