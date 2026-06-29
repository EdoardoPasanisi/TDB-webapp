// Blocco periodi pensione: CRUD per il gestionale + verifica conflitto per utente.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeDogBreedLookupKey } from '@/data/dogBreeds';

export type PensioneBlockScope = 'ALL' | 'BREEDS';

export type PensioneBlockRecord = {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  scope: PensioneBlockScope;
  breeds: string[];
  notes: string | null;
  createdAt: string;
};

type PensioneBlockRow = {
  id: string;
  start_date: string;
  end_date: string;
  scope: PensioneBlockScope;
  breeds: string[] | null;
  notes: string | null;
  created_at: string;
};

function mapRow(row: PensioneBlockRow): PensioneBlockRecord {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    scope: row.scope,
    breeds: row.breeds ?? [],
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

export async function listPensioneBlocks(args: {
  startDate: string;
  endDate: string;
}): Promise<PensioneBlockRecord[]> {
  const { startDate, endDate } = args;

  // Tutti i blocchi attivi che si sovrappongono alla finestra richiesta.
  const { data, error } = await supabaseAdmin
    .from('pensione_blocks')
    .select('id, start_date, end_date, scope, breeds, notes, created_at')
    .eq('is_active', true)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .order('start_date', { ascending: true });

  if (error) {
    throw new Error(error.message ?? 'Impossibile caricare i blocchi pensione.');
  }

  return ((data ?? []) as PensioneBlockRow[]).map(mapRow);
}

export async function upsertPensioneBlock(input: {
  blockId?: string | null;
  startDate: string;
  endDate: string;
  scope: PensioneBlockScope;
  breeds: string[];
  notes?: string | null;
  createdBy?: string | null;
}): Promise<PensioneBlockRecord> {
  const { blockId = null, startDate, endDate, scope, breeds, notes = null, createdBy = null } = input;

  const payload = {
    start_date: startDate,
    end_date: endDate,
    scope,
    breeds: scope === 'ALL' ? [] : breeds,
    notes,
    is_active: true,
  };

  const operation = blockId
    ? supabaseAdmin.from('pensione_blocks').update(payload).eq('id', blockId)
    : supabaseAdmin.from('pensione_blocks').insert({ ...payload, created_by: createdBy });

  const { data, error } = await operation
    .select('id, start_date, end_date, scope, breeds, notes, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare il blocco pensione.');
  }

  return mapRow(data as PensioneBlockRow);
}

export async function deletePensioneBlock(blockId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('pensione_blocks').delete().eq('id', blockId);
  if (error) {
    throw new Error(error.message ?? 'Impossibile eliminare il blocco pensione.');
  }
}

export type PensioneBlockConflict = {
  blocked: boolean;
  periods: Array<{ startDate: string; endDate: string }>;
};

/**
 * Verifica se il periodo [startDate, endDate] è bloccato per l'utente:
 * - scope ALL → bloccato sempre;
 * - scope BREEDS → bloccato se l'utente possiede almeno un cane attivo la cui razza
 *   (breed o una delle origin_breeds) compare tra le razze bloccate.
 * Se anche un solo cane è bloccato, l'utente è bloccato per l'intero periodo.
 */
export async function findPensioneBlockConflict(args: {
  userId: string;
  startDate: string;
  endDate: string;
}): Promise<PensioneBlockConflict> {
  const { userId, startDate, endDate } = args;

  const { data: blockRows, error: blocksError } = await supabaseAdmin
    .from('pensione_blocks')
    .select('id, start_date, end_date, scope, breeds, notes, created_at')
    .eq('is_active', true)
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (blocksError) {
    throw new Error(blocksError.message ?? 'Impossibile verificare i blocchi pensione.');
  }

  const blocks = ((blockRows ?? []) as PensioneBlockRow[]).map(mapRow);
  if (blocks.length === 0) {
    return { blocked: false, periods: [] };
  }

  const periods: Array<{ startDate: string; endDate: string }> = [];

  // Per i blocchi "per razze" servono le razze dei cani dell'utente.
  const breedBlocks = blocks.filter((block) => block.scope === 'BREEDS');

  let ownerBreedKeys: Set<string> | null = null;
  if (breedBlocks.length > 0) {
    const { data: dogRows, error: dogsError } = await supabaseAdmin
      .from('dogs')
      .select('breed, origin_breeds')
      .eq('owner_id', userId)
      .eq('is_active', true);

    if (dogsError) {
      throw new Error(dogsError.message ?? 'Impossibile verificare le razze dei cani.');
    }

    ownerBreedKeys = new Set<string>();
    for (const dog of (dogRows ?? []) as Array<{ breed: string | null; origin_breeds: string[] | null }>) {
      const key = normalizeDogBreedLookupKey(dog.breed);
      if (key) ownerBreedKeys.add(key);
      for (const origin of dog.origin_breeds ?? []) {
        const originKey = normalizeDogBreedLookupKey(origin);
        if (originKey) ownerBreedKeys.add(originKey);
      }
    }
  }

  for (const block of blocks) {
    if (block.scope === 'ALL') {
      periods.push({ startDate: block.startDate, endDate: block.endDate });
      continue;
    }
    if (!ownerBreedKeys || ownerBreedKeys.size === 0) continue;
    const blockKeys = block.breeds.map((breed) => normalizeDogBreedLookupKey(breed));
    const matches = blockKeys.some((key) => key && ownerBreedKeys!.has(key));
    if (matches) {
      periods.push({ startDate: block.startDate, endDate: block.endDate });
    }
  }

  return { blocked: periods.length > 0, periods };
}

function formatBlockDate(value: string): string {
  // value è YYYY-MM-DD → GG/MM/AAAA
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** Messaggio chiaro per l'utente con i periodi non disponibili. */
export function formatBlockedPeriodsMessage(
  periods: Array<{ startDate: string; endDate: string }>
): string {
  if (periods.length === 0) {
    return 'Non c’è posto in pensione per il periodo selezionato.';
  }
  const parts = periods.map((period) =>
    period.startDate === period.endDate
      ? `il ${formatBlockDate(period.startDate)}`
      : `dal ${formatBlockDate(period.startDate)} al ${formatBlockDate(period.endDate)}`
  );
  return `Non c’è posto in pensione per ${parts.join(' e ')}. Scegli un altro periodo.`;
}
