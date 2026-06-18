// Helper condiviso per derivare taglia/difficoltà lavaggio dalla razza in base alla specie.
import { findDogBreed, type DogSize, type WashDifficulty } from '@/data/dogBreeds';
import { findCatBreed } from '@/data/catBreeds';
import type { PetSpecies } from '@/types/dog';

export type BreedProfile = { size: DogSize; washDifficulty: WashDifficulty };

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
