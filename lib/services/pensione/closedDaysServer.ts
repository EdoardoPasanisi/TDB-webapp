// Eccezioni ai giorni di chiusura pensione (tabella pensione_closed_days), solo server.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ClosedDayOverride } from './holidays';

type ClosedDayRow = { day: string; closed: boolean; label: string | null };

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /pensione_closed_days/.test(error.message ?? '');
}

function mapRow(row: ClosedDayRow): ClosedDayOverride {
  return { date: row.day, closed: row.closed, label: row.label ?? null };
}

/**
 * Eccezioni dall'anno scorso in poi (quelle più vecchie non servono a nessuna
 * prenotazione nuova). Se la tabella non esiste ancora valgono solo i festivi.
 */
export async function loadClosedDayOverrides(options: { fromYear?: number } = {}): Promise<ClosedDayOverride[]> {
  const fromYear = options.fromYear ?? new Date().getFullYear() - 1;
  const { data, error } = await supabaseAdmin
    .from('pensione_closed_days')
    .select('day, closed, label')
    .gte('day', `${fromYear}-01-01`)
    .order('day', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message ?? 'Impossibile caricare i giorni di chiusura.');
  }

  return ((data ?? []) as ClosedDayRow[]).map(mapRow);
}

export async function upsertClosedDayOverride(input: {
  date: string;
  closed: boolean;
  label: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('pensione_closed_days')
    .upsert(
      { day: input.date, closed: input.closed, label: input.label, created_by: input.createdBy ?? null },
      { onConflict: 'day' }
    );
  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Funzione non ancora attiva: applica la migration pensione_closed_days.');
    }
    throw new Error(error.message ?? 'Impossibile salvare il giorno di chiusura.');
  }
}

/** Elimina l'eccezione: il giorno torna al comportamento di base (festivo = chiuso). */
export async function deleteClosedDayOverride(date: string): Promise<void> {
  const { error } = await supabaseAdmin.from('pensione_closed_days').delete().eq('day', date);
  if (error && !isMissingTableError(error)) {
    throw new Error(error.message ?? 'Impossibile ripristinare il giorno.');
  }
}
