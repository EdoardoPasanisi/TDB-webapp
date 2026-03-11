// FILE: lib/validation/italy.ts

/**
 * Utilities per validazioni italiane (soft validation lato client).
 * Nota: validazioni di formato + (per CF) checksum.
 */

export function sanitizeFiscalCode(value: string): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

// Codice Fiscale: checksum (posizioni 1,3,5... = dispari se indicizziamo da 1)
const ODD_MAP: Record<string, number> = {
  '0': 1,  '1': 0,  '2': 5,  '3': 7,  '4': 9,  '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN_MAP: Record<string, number> = {
  '0': 0,  '1': 1,  '2': 2,  '3': 3,  '4': 4,  '5': 5,  '6': 6,  '7': 7,  '8': 8,  '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CHECK_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function isValidItalianFiscalCode(raw: string): boolean {
  const cf = sanitizeFiscalCode(raw);
  if (!cf) return false;
  if (!/^[A-Z0-9]{16}$/.test(cf)) return false;

  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    const ch = cf[i];
    const pos = i + 1;
    if (pos % 2 === 1) sum += ODD_MAP[ch];
    else sum += EVEN_MAP[ch];
  }

  const expected = CHECK_CHARS[sum % 26];
  return expected === cf[15];
}

export function sanitizeMicrochip(value: string): string {
  return (value ?? '').replace(/\s+/g, '').trim();
}

/** Microchip tipico ISO 11784/11785: 15 cifre */
export function isValidMicrochip(raw: string): boolean {
  const v = sanitizeMicrochip(raw);
  if (!v) return false;
  return /^\d{15}$/.test(v);
}
