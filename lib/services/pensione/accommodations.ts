// Catalogo alloggi pensione (isomorfo: client e server).
//
// Gli alloggi e le loro tariffe vivono nella tabella `pensione_accommodations` e si
// gestiscono dal gestionale (Config → Alloggi). Questo modulo contiene solo tipi e
// funzioni pure: il catalogo arriva dal server (loadAccommodationCatalog) o dall'hook
// client (useAccommodationCatalog). DEFAULT_ACCOMMODATIONS è il seed della migration
// e il fallback se la tabella non è raggiungibile.
//
// Prezzi: tariffa TOTALE €/giorno per numero di cani dello stesso proprietario nella
// prenotazione [1 cane, 2 cani, 3+ cani] — lo sconto multi-cane è incorporato nei tier.
// La tariffa per singolo cane è totaleTier / min(cani, 3); oltre il 3° cane resta
// quella del tier "3".
//
// Climatizzazione: interruttore per alloggio gestito SOLO dal gestionale. Quando è
// attiva, ogni prenotazione in quell'alloggio paga `climatePricePerDay` €/giorno in più
// per cane; il cliente non la sceglie, la vede solo nel preventivo.

import type { BookingDogExtras } from '@/types/booking';
import type { PetSpecies } from '@/types/dog';

export type AccommodationSpecies = 'DOG' | 'CAT';

export interface Accommodation {
  key: string;
  label: string;
  species: AccommodationSpecies;
  /** Totale €/giorno per [1 cane, 2 cani, 3+ cani]. */
  tierPrices: [number, number, number];
  /** Climatizzazione attiva: supplemento automatico su tutte le prenotazioni. */
  climateActive: boolean;
  climatePricePerDay: number;
  /** false = eliminato dal gestionale: non prenotabile, ma resta per lo storico. */
  active: boolean;
  sortOrder: number;
}

export type AccommodationCatalog = Accommodation[];

export const CLIMATE_DEFAULT_PRICE_PER_DAY = 3;

const dog = (
  key: string,
  label: string,
  tierPrices: [number, number, number],
  sortOrder: number
): Accommodation => ({
  key,
  label,
  species: 'DOG',
  tierPrices,
  climateActive: false,
  climatePricePerDay: CLIMATE_DEFAULT_PRICE_PER_DAY,
  active: true,
  sortOrder,
});

// Deve restare allineato al seed in supabase/migrations/20260928000000_*.sql.
export const DEFAULT_ACCOMMODATIONS: AccommodationCatalog = [
  // Box: 30€; più cani = sconto 10% (2 cani 54€, 3 cani 81€).
  dog('BOX', 'Box', [30, 54, 81], 10),
  // Box con giardino: 40€ con lo stesso sconto multi-cane del Box.
  dog('BOX_GARDEN', 'Box con giardino', [40, 72, 108], 20),
  dog('CHALET', 'Chalet', [35, 60, 90], 30),
  dog('HOTEL', 'Hotel - stanza luxury con giardino', [45, 80, 110], 40),
  dog('APT_GARDEN', 'Appartamento con giardino', [50, 90, 120], 50),
  dog('APT_GARDEN_NIGHT_PERSON', 'Appartamento con giardino (presenza notturna)', [100, 180, 240], 60),
  {
    ...dog('CATTERY', 'Gattile', [25, 45, 60], 70),
    species: 'CAT',
  },
];

function sortCatalog(catalog: AccommodationCatalog): AccommodationCatalog {
  return [...catalog].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'it'));
}

export function findAccommodation(
  catalog: AccommodationCatalog,
  key: string | null | undefined
): Accommodation | null {
  if (!key) return null;
  return catalog.find((item) => item.key === key) ?? null;
}

/** Tier 1/2/3 in base al numero totale di cani del proprietario nella prenotazione. */
function tierIndex(totalDogs: number): 0 | 1 | 2 {
  const tier = Math.min(Math.max(Math.floor(totalDogs) || 1, 1), 3);
  return (tier - 1) as 0 | 1 | 2;
}

/**
 * Tariffa alloggio €/giorno PER SINGOLO CANE. Alloggio sconosciuto → 0 (la validazione
 * a monte impedisce di arrivarci con una prenotazione reale).
 */
export function accommodationPricePerDay(
  catalog: AccommodationCatalog,
  key: string,
  totalDogs: number
): number {
  const accommodation = findAccommodation(catalog, key);
  if (!accommodation) return 0;
  const index = tierIndex(totalDogs);
  const total = accommodation.tierPrices[index];
  return Math.round((total / (index + 1)) * 100) / 100;
}

/** €/giorno di climatizzazione applicati oggi a quell'alloggio (0 se spenta). */
export function accommodationClimatePricePerDay(catalog: AccommodationCatalog, key: string): number {
  const accommodation = findAccommodation(catalog, key);
  return accommodation?.climateActive ? accommodation.climatePricePerDay : 0;
}

// Alloggi prenotabili per specie: i cani non usano il gattile, i gatti solo quello,
// "altro" non è prenotabile in pensione. Solo alloggi attivi.
export function accommodationOptionsForSpecies(
  catalog: AccommodationCatalog,
  species: PetSpecies
): Accommodation[] {
  if (species === 'OTHER') return [];
  const wanted: AccommodationSpecies = species === 'CAT' ? 'CAT' : 'DOG';
  return sortCatalog(catalog).filter((item) => item.active && item.species === wanted);
}

export function defaultAccommodationForSpecies(catalog: AccommodationCatalog, species: PetSpecies): string {
  const first = accommodationOptionsForSpecies(catalog, species)[0];
  if (first) return first.key;
  return species === 'CAT' ? 'CATTERY' : 'BOX';
}

const BUILTIN_LABELS = new Map(DEFAULT_ACCOMMODATIONS.map((item) => [item.key, item.label]));

/**
 * Etichetta leggibile di un alloggio. Ordine: etichetta storicizzata sulla prenotazione
 * (extras.accommodationLabel) → catalogo → alloggi di serie → chiave.
 */
export function resolveAccommodationLabel(
  key: string | null | undefined,
  options: { catalog?: AccommodationCatalog | null; extras?: BookingDogExtras | null } = {}
): string | null {
  if (options.extras?.accommodationLabel) return options.extras.accommodationLabel;
  if (!key) return null;
  return (
    findAccommodation(options.catalog ?? [], key)?.label ??
    BUILTIN_LABELS.get(key) ??
    key.replaceAll('_', ' ')
  );
}

/** Chiave stabile per un nuovo alloggio, derivata dal nome (es. "Box XL" → BOX_XL). */
export function accommodationKeyFromLabel(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || 'ALLOGGIO';
}

export const ACCOMMODATION_KEY_PATTERN = /^[A-Z0-9_]{1,48}$/;

/**
 * Riallinea le scelte per cane al catalogo corrente: un alloggio non più prenotabile
 * torna al primo disponibile per la specie. Restituisce lo stesso oggetto se non cambia
 * nulla (sicuro dentro useMemo/setState senza render inutili).
 */
export function reconcilePerDogAccommodations<F extends { accommodationType: string }>(
  catalog: AccommodationCatalog,
  dogs: Array<{ id: string; species?: PetSpecies | null }>,
  forms: Record<string, F>
): Record<string, F> {
  let changed = false;
  const next: Record<string, F> = { ...forms };
  for (const dog of dogs) {
    const form = forms[dog.id];
    if (!form) continue;
    const species = dog.species ?? 'DOG';
    const options = accommodationOptionsForSpecies(catalog, species);
    if (options.length && !options.some((item) => item.key === form.accommodationType)) {
      next[dog.id] = { ...form, accommodationType: defaultAccommodationForSpecies(catalog, species) };
      changed = true;
    }
  }
  return changed ? next : forms;
}
