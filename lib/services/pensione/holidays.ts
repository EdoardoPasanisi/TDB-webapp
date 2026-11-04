// lib/services/pensione/holidays.ts
// Giorni di chiusura pensione: niente ingressi né uscite (si può comunque restare in
// pensione a cavallo). Di base sono chiusi i festivi nazionali italiani; lo staff può
// aggiungere altri giorni o riaprire un festivo (eccezioni salvate in
// pensione_closed_days). Modulo isomorfo: usato dal form cliente, dal gestionale e
// dalla validazione server.

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Domenica di Pasqua (algoritmo di Meeus/Jones/Butcher, calendario gregoriano). */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const FIXED_HOLIDAYS: Array<{ month: number; day: number; name: string; fromYear?: number }> = [
  { month: 1, day: 1, name: 'Capodanno' },
  { month: 1, day: 6, name: 'Epifania' },
  { month: 4, day: 25, name: 'Festa della Liberazione' },
  { month: 5, day: 1, name: 'Festa del Lavoro' },
  { month: 6, day: 2, name: 'Festa della Repubblica' },
  { month: 8, day: 15, name: 'Ferragosto' },
  // San Francesco d'Assisi: di nuovo festa nazionale dal 2026.
  { month: 10, day: 4, name: 'San Francesco', fromYear: 2026 },
  { month: 11, day: 1, name: 'Ognissanti' },
  { month: 12, day: 8, name: 'Immacolata' },
  { month: 12, day: 25, name: 'Natale' },
  { month: 12, day: 26, name: 'Santo Stefano' },
];

const cache = new Map<number, Map<string, string>>();

function holidaysForYear(year: number): Map<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const map = new Map<string, string>();
  for (const holiday of FIXED_HOLIDAYS) {
    if (holiday.fromYear && year < holiday.fromYear) continue;
    map.set(toISO(year, holiday.month, holiday.day), holiday.name);
  }

  const easter = easterSunday(year);
  map.set(toISO(year, easter.month, easter.day), 'Pasqua');
  // Lunedì dell'Angelo = Pasqua + 1 giorno (UTC per evitare sorprese con l'ora legale).
  const monday = new Date(Date.UTC(year, easter.month - 1, easter.day + 1));
  map.set(toISO(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()), 'Pasquetta');

  cache.set(year, map);
  return map;
}

/** Nome del festivo nazionale se `value` (YYYY-MM-DD) lo è, altrimenti null. */
export function getHolidayName(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return holidaysForYear(year).get(value) ?? null;
}

/** Eccezione decisa dallo staff per un giorno (vedi pensione_closed_days). */
export type ClosedDayOverride = {
  date: string; // YYYY-MM-DD
  closed: boolean; // true = chiusura aggiunta, false = festivo riaperto
  label: string | null;
};

const DEFAULT_CLOSED_LABEL = 'Chiusura';

function overrideMap(overrides: readonly ClosedDayOverride[]): Map<string, ClosedDayOverride> {
  return new Map(overrides.map((item) => [item.date, item]));
}

/**
 * Motivo della chiusura se in quel giorno non si può entrare né uscire, altrimenti null.
 * L'eccezione dello staff prevale sul calendario dei festivi.
 */
export function getClosedDayLabel(
  value: string | null | undefined,
  overrides: readonly ClosedDayOverride[] = []
): string | null {
  if (!value) return null;
  const override = overrides.find((item) => item.date === value);
  const holiday = getHolidayName(value);
  if (override) {
    return override.closed ? override.label?.trim() || holiday || DEFAULT_CLOSED_LABEL : null;
  }
  return holiday;
}

export type ClosedDayEntry = {
  date: string;
  label: string;
  /** HOLIDAY = festivo nazionale, CUSTOM = giorno aggiunto dallo staff. */
  source: 'HOLIDAY' | 'CUSTOM';
  closed: boolean;
};

/** Calendario dell'anno per il gestionale: festivi (chiusi o riaperti) + giorni aggiunti. */
export function listClosedDaysForYear(year: number, overrides: readonly ClosedDayOverride[] = []): ClosedDayEntry[] {
  const byDate = overrideMap(overrides);
  const entries: ClosedDayEntry[] = [];

  for (const [date, name] of holidaysForYear(year)) {
    const override = byDate.get(date);
    entries.push({
      date,
      label: override?.closed && override.label?.trim() ? override.label.trim() : name,
      source: 'HOLIDAY',
      closed: override ? override.closed : true,
    });
  }

  for (const override of overrides) {
    if (!override.date.startsWith(`${year}-`) || !override.closed) continue;
    if (holidaysForYear(year).has(override.date)) continue;
    entries.push({
      date: override.date,
      label: override.label?.trim() || DEFAULT_CLOSED_LABEL,
      source: 'CUSTOM',
      closed: true,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Messaggio d'errore se il giorno di ingresso o di uscita cade in un giorno di chiusura.
 * I giorni intermedi non contano: si può restare in pensione durante la chiusura.
 */
export function findHolidayTransitError(
  startDate: string,
  endDate: string,
  overrides: readonly ClosedDayOverride[] = []
): string | null {
  const startClosed = getClosedDayLabel(startDate, overrides);
  const endClosed = getClosedDayLabel(endDate, overrides);
  if (!startClosed && !endClosed) return null;

  const closedNote = 'Nei giorni festivi e di chiusura la pensione non accetta ingressi né uscite';

  if (startClosed && endClosed && startDate === endDate) {
    return `${closedNote}: il ${formatDate(startDate)} (${startClosed}) non è possibile né portare né riprendere il cane. Scegli altre date.`;
  }

  const parts: string[] = [];
  if (startClosed) {
    parts.push(`portare il cane il ${formatDate(startDate)} (${startClosed})`);
  }
  if (endClosed) {
    parts.push(`riprendere il cane il ${formatDate(endDate)} (${endClosed})`);
  }
  return `${closedNote}: non è possibile ${parts.join(' né ')}. Il cane può restare in pensione durante quei giorni, ma l’arrivo e la partenza vanno spostati in un giorno di apertura.`;
}
