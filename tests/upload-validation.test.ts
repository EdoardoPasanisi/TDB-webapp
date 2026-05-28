import test from 'node:test';
import assert from 'node:assert/strict';

import { validateUploadBytes, validateUploadFile } from '../lib/validation/uploads';

test('validateUploadFile accepts a supported document within size limit', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'document.pdf', {
    type: 'application/pdf',
  });

  const result = validateUploadFile({
    file,
    allowedMimeTypes: new Set(['application/pdf']),
    maxBytes: 1024,
    invalidTypeMessage: 'Formato non valido.',
    tooLargeMessage: 'File troppo grande.',
  });

  assert.equal(result, null);
});

test('validateUploadFile rejects empty uploads', () => {
  const file = new File([], 'document.pdf', {
    type: 'application/pdf',
  });

  const result = validateUploadFile({
    file,
    allowedMimeTypes: new Set(['application/pdf']),
    maxBytes: 1024,
    invalidTypeMessage: 'Formato non valido.',
    tooLargeMessage: 'File troppo grande.',
  });

  assert.equal(result, 'Il file selezionato è vuoto.');
});

test('validateUploadFile rejects oversized uploads before type checks', () => {
  const file = new File([new Uint8Array(2048)], 'photo.png', {
    type: 'image/png',
  });

  const result = validateUploadFile({
    file,
    allowedMimeTypes: new Set(['image/png']),
    maxBytes: 1024,
    invalidTypeMessage: 'Formato non valido.',
    tooLargeMessage: 'File troppo grande.',
  });

  assert.equal(result, 'File troppo grande.');
});

test('validateUploadFile rejects unsupported mime types', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'script.exe', {
    type: 'application/octet-stream',
  });

  const result = validateUploadFile({
    file,
    allowedMimeTypes: new Set(['application/pdf']),
    maxBytes: 1024,
    invalidTypeMessage: 'Formato non valido.',
    tooLargeMessage: 'File troppo grande.',
  });

  assert.equal(result, 'Formato non valido.');
});

test('validateUploadBytes accepts matching PDF signatures', () => {
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'document.pdf', {
    type: 'application/pdf',
  });

  const result = validateUploadBytes(file, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));

  assert.equal(result, null);
});

test('validateUploadBytes rejects spoofed image uploads', () => {
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'photo.png', {
    type: 'image/png',
  });

  const result = validateUploadBytes(file, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));

  assert.equal(result, 'Il file PNG non è valido.');
});
