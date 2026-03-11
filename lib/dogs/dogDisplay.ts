// lib/dogs/dogDisplay.ts
import type { DogSex } from '@/types/dog';

/**
 * Alcune indoli non sono gestibili con la regola "ultima parola o->a"
 * (es. "giocherellone" -> "giocherellona").
 * Qui mettiamo solo i casi davvero speciali.
 */
const TEMPERAMENT_FEMALE_OVERRIDES: Record<string, string> = {
  giocherellone: 'Giocherellona',
};
/**
 * Converte una singola etichetta "temperamento" al femminile, se serve.
 * - Gestisce frasi che iniziano con "Buono ..." -> "Buona ..."
 * - Altrimenti prova a modificare l'ultima parola se termina con "o" -> "a"
 * - Applica prima una mappa di override per i casi speciali
 */
export function genderedTemperamentLabel(option: string, sex: DogSex | null | undefined): string {
  if (!option) return option;
  if (sex !== 'female') return option;

  const trimmed = option.trim();
  if (!trimmed) return option;

  // Override speciali (case-insensitive)
  const key = trimmed.toLowerCase();
  const overridden = TEMPERAMENT_FEMALE_OVERRIDES[key];
  if (overridden) return overridden;

  // Caso speciale: frasi che iniziano con "Buono ..."
  if (/^Buono\b/.test(trimmed)) {
    return trimmed.replace(/^Buono\b/, 'Buona');
  }
  if (/^Sicuro\b/.test(trimmed)) {
    return trimmed.replace(/^Sicuro\b/, 'Sicura');
  }
  // Regola generale: lavora sull'ultima parola
  const parts = trimmed.split(' ');
  const last = parts[parts.length - 1];

  if (last && last.endsWith('o')) {
    const lastFem = last.slice(0, -1) + 'a';
    return [...parts.slice(0, -1), lastFem].join(' ');
  }

  return trimmed;
}

export function formatTemperamentsForDisplay(
  temperaments: string[] | null | undefined,
  sex: DogSex | null | undefined
): string[] {
  if (!temperaments || temperaments.length === 0) return [];
  return temperaments
    .map((t) => t?.trim())
    .filter((t): t is string => !!t)
    .map((t) => genderedTemperamentLabel(t, sex));
}

/**
 * Ritorna un'età “pulita” solo se la birth_date è presente e valida, altrimenti null.
 * Es: "2 anni 3 mesi", "1 anno", "3 mesi", null.
 */
export function getAgeLabel(birthDateIso: string | null | undefined): string | null {
  if (!birthDateIso) return null;

  const m = birthDateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const birth = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth() + 1; // 1..12
  const nowD = now.getUTCDate();

  let totalMonths = (nowY - year) * 12 + (nowM - month);
  if (nowD < day) totalMonths -= 1;

  if (totalMonths < 0) return null;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const yearLabel = years === 1 ? 'anno' : 'anni';
  const monthLabel = months === 1 ? 'mese' : 'mesi';

  if (years === 0 && months === 0) return '0 mesi';
  if (years === 0) return `${months} ${monthLabel}`;
  if (months === 0) return `${years} ${yearLabel}`;

  return `${years} ${yearLabel} ${months} ${monthLabel}`;
}
