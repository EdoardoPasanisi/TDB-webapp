// Lettura/scrittura del catalogo alloggi (tabella pensione_accommodations). Solo server.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  ACCOMMODATION_KEY_PATTERN,
  CLIMATE_DEFAULT_PRICE_PER_DAY,
  DEFAULT_ACCOMMODATIONS,
  accommodationKeyFromLabel,
  type Accommodation,
  type AccommodationCatalog,
  type AccommodationSpecies,
} from './accommodations';

type AccommodationRow = {
  key: string;
  label: string;
  species: string;
  price_1_dog: number | string;
  price_2_dogs: number | string;
  price_3_dogs: number | string;
  climate_active: boolean;
  climate_price_per_day: number | string;
  is_active: boolean;
  sort_order: number;
};

const COLUMNS =
  'key, label, species, price_1_dog, price_2_dogs, price_3_dogs, climate_active, climate_price_per_day, is_active, sort_order';

function mapRow(row: AccommodationRow): Accommodation {
  return {
    key: row.key,
    label: row.label,
    species: row.species === 'CAT' ? 'CAT' : 'DOG',
    tierPrices: [Number(row.price_1_dog), Number(row.price_2_dogs), Number(row.price_3_dogs)],
    climateActive: Boolean(row.climate_active),
    climatePricePerDay: Number(row.climate_price_per_day),
    active: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/**
 * Catalogo completo (anche gli alloggi eliminati, che servono per etichette e per
 * modificare prenotazioni esistenti). Se la tabella non è raggiungibile — per esempio
 * migration non ancora applicata — ricade sugli alloggi di serie invece di bloccare
 * le prenotazioni.
 */
export async function loadAccommodationCatalog(): Promise<AccommodationCatalog> {
  const { data, error } = await supabaseAdmin
    .from('pensione_accommodations')
    .select(COLUMNS)
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) console.error('pensione_accommodations non disponibile, uso gli alloggi di serie:', error.message);
    return DEFAULT_ACCOMMODATIONS;
  }

  return (data as AccommodationRow[]).map(mapRow);
}

export class AccommodationInputError extends Error {}

function parsePrice(value: unknown, label: string): number {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) {
    throw new AccommodationInputError(`${label}: inserisci un prezzo valido.`);
  }
  return Math.round(parsed * 100) / 100;
}

export type AccommodationInput = Omit<Accommodation, 'key' | 'active'> & { key?: string };

export function sanitizeAccommodationInput(body: unknown): AccommodationInput {
  const value = (body ?? {}) as Record<string, unknown>;
  const label = String(value.label ?? '').trim().slice(0, 80);
  if (!label) throw new AccommodationInputError('Il nome dell’alloggio è obbligatorio.');

  const species: AccommodationSpecies = value.species === 'CAT' ? 'CAT' : 'DOG';
  const tiers = Array.isArray(value.tierPrices) ? value.tierPrices : [];
  const tierPrices: [number, number, number] = [
    parsePrice(tiers[0], 'Prezzo 1 cane'),
    parsePrice(tiers[1], 'Prezzo 2 cani'),
    parsePrice(tiers[2], 'Prezzo 3+ cani'),
  ];
  if (tierPrices[0] <= 0) throw new AccommodationInputError('Il prezzo per 1 cane deve essere maggiore di zero.');

  const climateActive = value.climateActive === true;
  const climatePricePerDay =
    value.climatePricePerDay === undefined || value.climatePricePerDay === ''
      ? CLIMATE_DEFAULT_PRICE_PER_DAY
      : parsePrice(value.climatePricePerDay, 'Prezzo climatizzazione');

  const sortOrder = Number.isFinite(Number(value.sortOrder)) ? Math.round(Number(value.sortOrder)) : 100;

  return { label, species, tierPrices, climateActive, climatePricePerDay, sortOrder };
}

function toRow(input: AccommodationInput) {
  return {
    label: input.label,
    species: input.species,
    price_1_dog: input.tierPrices[0],
    price_2_dogs: input.tierPrices[1],
    price_3_dogs: input.tierPrices[2],
    climate_active: input.climateActive,
    climate_price_per_day: input.climatePricePerDay,
    sort_order: input.sortOrder,
    updated_at: new Date().toISOString(),
  };
}

export async function createAccommodation(input: AccommodationInput): Promise<Accommodation> {
  const existing = await loadAccommodationCatalog();
  const base = accommodationKeyFromLabel(input.label);
  let key = base;
  for (let i = 2; existing.some((item) => item.key === key); i += 1) key = `${base}_${i}`;

  const { data, error } = await supabaseAdmin
    .from('pensione_accommodations')
    .insert({ key, is_active: true, ...toRow(input) })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Impossibile creare l’alloggio.');
  return mapRow(data as AccommodationRow);
}

export function assertAccommodationKey(value: unknown): string {
  const key = String(value ?? '').trim();
  if (!ACCOMMODATION_KEY_PATTERN.test(key)) throw new AccommodationInputError('Alloggio non valido.');
  return key;
}

export async function updateAccommodation(key: string, input: AccommodationInput): Promise<Accommodation> {
  const { data, error } = await supabaseAdmin
    .from('pensione_accommodations')
    .update(toRow(input))
    .eq('key', key)
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Alloggio non trovato.');
  return mapRow(data as AccommodationRow);
}

/**
 * "Elimina" = archivia: l'alloggio sparisce dalle scelte di prenotazione ma resta nel
 * DB, perché le prenotazioni passate lo referenziano (nome e prezzi storici).
 */
export async function setAccommodationActive(key: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from('pensione_accommodations')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('key', key);
  if (error) throw new Error(error.message);
}
