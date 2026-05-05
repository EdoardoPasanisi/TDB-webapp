import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { supabase } from '@/lib/supabaseClient';

export type ServiceSlotDogSummary = {
  id: string;
  name: string | null;
  breed: string | null;
};

type ServiceSlotDogSource = {
  dog_ids?: string[] | null;
  dog_id?: string | null;
};

type ServiceSlotDogRow = Pick<ServiceSlotDogSummary, 'id' | 'name' | 'breed'>;

export function getServiceSlotDogIds(source: ServiceSlotDogSource): string[] {
  return Array.from(
    new Set(
      [...(source.dog_ids ?? []), source.dog_id ?? '']
        .map((dogId) => String(dogId ?? '').trim())
        .filter(Boolean)
    )
  );
}

export function mapServiceSlotDogs(
  source: ServiceSlotDogSource,
  dogMap: Map<string, ServiceSlotDogSummary>
): ServiceSlotDogSummary[] {
  return getServiceSlotDogIds(source)
    .map((dogId) => dogMap.get(dogId) ?? null)
    .filter((dog): dog is ServiceSlotDogSummary => Boolean(dog));
}

export async function loadServiceSlotDogSummaryMap(
  sources: ServiceSlotDogSource[]
): Promise<Map<string, ServiceSlotDogSummary>> {
  const dogIds = Array.from(new Set(sources.flatMap((source) => getServiceSlotDogIds(source))));
  const dogMap = new Map<string, ServiceSlotDogSummary>();

  if (dogIds.length === 0) return dogMap;

  const { data, error } = await supabase
    .from('dogs')
    .select('id, name, breed')
    .in('id', dogIds);

  if (error) throw new Error(humanizeErrorMessage(error, 'Non siamo riusciti a caricare i cani collegati al servizio.'));

  for (const row of (data ?? []) as ServiceSlotDogRow[]) {
    dogMap.set(row.id, {
      id: row.id,
      name: row.name ?? null,
      breed: row.breed ?? null,
    });
  }

  return dogMap;
}
