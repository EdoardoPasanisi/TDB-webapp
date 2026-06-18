// Razze feline — stessa struttura di data/dogBreeds.ts (riusa la normalizzazione lookup).
// La taglia non incide sul prezzo (la pensione gatti è a tariffa gattile fissa): è informativa.
import { normalizeDogBreedLookupKey, type DogSize, type WashDifficulty } from '@/data/dogBreeds';

export type CatBreed = {
  name: string;
  aliases: string[];
  hiddenAliases?: string[];
  size: DogSize;
  coat: string;
  washDifficulty: WashDifficulty;
};

export function getCatBreedSearchScore(breed: CatBreed, query: string | null | undefined): number {
  const normalizedQuery = normalizeDogBreedLookupKey(query);
  if (!normalizedQuery) return 0;

  const normalizedName = normalizeDogBreedLookupKey(breed.name);
  if (normalizedName === normalizedQuery) return 500;
  if (normalizedName.startsWith(normalizedQuery)) return 400;
  if (normalizedName.includes(normalizedQuery)) return 300;

  let bestAliasScore = 0;
  for (const alias of [...breed.aliases, ...(breed.hiddenAliases ?? [])]) {
    const normalizedAlias = normalizeDogBreedLookupKey(alias);
    if (normalizedAlias === normalizedQuery) return 350;
    if (normalizedAlias.startsWith(normalizedQuery)) bestAliasScore = Math.max(bestAliasScore, 260);
    else if (normalizedAlias.includes(normalizedQuery)) bestAliasScore = Math.max(bestAliasScore, 220);
  }

  return bestAliasScore;
}

export const CAT_BREEDS: CatBreed[] = [
  { name: 'Abissino', aliases: ['Abyssinian'], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'American Bobtail', aliases: [], size: 'media', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'American Curl', aliases: [], size: 'piccola', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'American Shorthair', aliases: ['ASH'], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'American Wirehair', aliases: [], size: 'media', coat: 'Pelo ruvido', washDifficulty: 1 },
  { name: 'Angora Turco', aliases: ['Turkish Angora', 'Angora'], size: 'piccola', coat: 'Pelo lungo', washDifficulty: 2 },
  { name: 'Balinese', aliases: ['Balinese'], size: 'piccola', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'Bengala', aliases: ['Bengal'], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Birmano', aliases: ['Sacro di Birmania', 'Birman'], size: 'media', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'Bombay', aliases: [], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'British Longhair', aliases: ['BLH'], size: 'media', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'British Shorthair', aliases: ['BSH', 'Britannico a pelo corto'], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Burmese', aliases: ['Birmano europeo'], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Burmilla', aliases: [], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Certosino', aliases: ['Chartreux'], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Cornish Rex', aliases: [], size: 'piccola', coat: 'Pelo riccio', washDifficulty: 1 },
  { name: 'Devon Rex', aliases: [], size: 'piccola', coat: 'Pelo riccio', washDifficulty: 1 },
  { name: 'Egyptian Mau', aliases: ['Mau egiziano'], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Exotic Shorthair', aliases: ['Esotico a pelo corto'], size: 'media', coat: 'Pelo corto', washDifficulty: 2 },
  { name: 'Havana Brown', aliases: [], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Korat', aliases: [], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'LaPerm', aliases: [], size: 'piccola', coat: 'Pelo riccio', washDifficulty: 2 },
  { name: 'Maine Coon', aliases: ['Coon'], size: 'grande', coat: 'Pelo lungo', washDifficulty: 3 },
  { name: 'Manx', aliases: ['Gatto dell’Isola di Man'], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Munchkin', aliases: [], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Norvegese delle Foreste', aliases: ['Norwegian Forest Cat', 'Norvegese'], size: 'grande', coat: 'Pelo lungo', washDifficulty: 3 },
  { name: 'Ocicat', aliases: [], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Orientale', aliases: ['Oriental Shorthair'], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Persiano', aliases: ['Persian'], size: 'media', coat: 'Pelo lungo', washDifficulty: 3 },
  { name: 'Peterbald', aliases: [], size: 'piccola', coat: 'Pelo assente', washDifficulty: 2 },
  { name: 'Pixie-bob', aliases: [], size: 'media', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'Ragamuffin', aliases: [], size: 'grande', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'Ragdoll', aliases: [], size: 'grande', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'Blu di Russia', aliases: ['Russian Blue'], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Savannah', aliases: [], size: 'grande', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Scottish Fold', aliases: [], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Selkirk Rex', aliases: [], size: 'media', coat: 'Pelo riccio', washDifficulty: 2 },
  { name: 'Siamese', aliases: ['Siamese'], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Siberiano', aliases: ['Siberian'], size: 'grande', coat: 'Pelo lungo', washDifficulty: 3 },
  { name: 'Singapura', aliases: [], size: 'toy', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Snowshoe', aliases: [], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Somalo', aliases: ['Somali'], size: 'piccola', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'Sphynx', aliases: ['Gatto nudo'], size: 'piccola', coat: 'Pelo assente', washDifficulty: 2 },
  { name: 'Tonchinese', aliases: ['Tonkinese'], size: 'piccola', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Toyger', aliases: [], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
  { name: 'Turco Van', aliases: ['Turkish Van'], size: 'media', coat: 'Pelo semilungo', washDifficulty: 2 },
  { name: 'Meticcio', aliases: ['Europeo', 'Soriano', 'Comune europeo'], size: 'media', coat: 'Pelo corto', washDifficulty: 1 },
];

export const CAT_BREEDS_BY_NAME = new Map(
  CAT_BREEDS.map((breed) => [normalizeDogBreedLookupKey(breed.name), breed])
);

export function findCatBreed(value: string | null | undefined): CatBreed | null {
  const key = normalizeDogBreedLookupKey(value);
  if (!key) return null;
  return CAT_BREEDS_BY_NAME.get(key) ?? null;
}
