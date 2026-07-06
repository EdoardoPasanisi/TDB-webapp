// Helper condiviso per derivare taglia/difficoltà lavaggio dalla razza in base alla specie.
import { findDogBreed, type DogSize, type WashDifficulty } from '@/data/dogBreeds';
import { findCatBreed } from '@/data/catBreeds';
import type { PetSpecies } from '@/types/dog';

export type BreedProfile = { size: DogSize; washDifficulty: WashDifficulty };

// Ordine crescente delle taglie: usato per calcolare la "massima" tra più razze.
export const SIZE_ORDER: DogSize[] = ['toy', 'piccola', 'media', 'grande', 'gigante'];

// Profilo "meticcio" senza razze di provenienza: taglia nascosta a cui applichiamo i
// prezzi massimi (come se fosse gigante e molto difficile da lavare).
export const METICCIO_DEFAULT_PROFILE: BreedProfile = { size: 'gigante', washDifficulty: 3 };

export function isMeticcioBreed(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === 'meticcio';
}

function maxSize(a: DogSize, b: DogSize): DogSize {
  return SIZE_ORDER.indexOf(a) >= SIZE_ORDER.indexOf(b) ? a : b;
}

/**
 * Profilo per un meticcio: se sono indicate razze di provenienza, taglia e difficoltà
 * di lavaggio sono le più alte tra quelle selezionate; altrimenti si usa il profilo
 * di default (gigante + difficoltà massima).
 */
export function resolveMeticcioProfile(originBreeds: string[] | null | undefined): BreedProfile {
  const profiles = (originBreeds ?? [])
    .map((name) => findDogBreed(name))
    .filter((breed): breed is NonNullable<typeof breed> => Boolean(breed));

  if (profiles.length === 0) return { ...METICCIO_DEFAULT_PROFILE };

  return profiles.reduce<BreedProfile>(
    (acc, breed) => ({
      size: maxSize(acc.size, breed.size),
      washDifficulty: Math.max(acc.washDifficulty, breed.washDifficulty) as WashDifficulty,
    }),
    { size: 'toy', washDifficulty: 1 }
  );
}

export function findBreedProfileForSpecies(
  species: PetSpecies,
  name: string | null | undefined
): BreedProfile | null {
  if (species === 'CAT') {
    const breed = findCatBreed(name);
    return breed ? { size: breed.size, washDifficulty: breed.washDifficulty } : null;
  }
  if (species === 'DOG') {
    const breed = findDogBreed(name);
    return breed ? { size: breed.size, washDifficulty: breed.washDifficulty } : null;
  }
  return null; // OTHER: nessuna razza
}

/**
 * Profilo taglia/difficoltà autoritativo per un cane/gatto, gestendo il caso "Meticcio"
 * in base alle razze di provenienza. Per "Altro" (nessuna razza) ritorna null.
 */
export function resolveDogBreedProfile(
  species: PetSpecies,
  breed: string | null | undefined,
  originBreeds: string[] | null | undefined
): BreedProfile | null {
  if (species === 'DOG' && isMeticcioBreed(breed)) {
    return resolveMeticcioProfile(originBreeds);
  }
  return findBreedProfileForSpecies(species, breed);
}
