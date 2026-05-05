import test from 'node:test';
import assert from 'node:assert/strict';

import { findDogBreed } from '../data/dogBreeds';

test('findDogBreed resolves aliases to the canonical breed profile', () => {
  const breed = findDogBreed('Alano');

  assert.ok(breed);
  assert.equal(breed?.name, 'Great Dane');
  assert.equal(breed?.size, 'gigante');
});

test('findDogBreed keeps legacy canonical names searchable after the catalog update', () => {
  const breed = findDogBreed('Bulldog Francese');

  assert.ok(breed);
  assert.equal(breed?.name, 'French Bulldog');
  assert.equal(breed?.washDifficulty, 1);
});

test('findDogBreed is accent-insensitive for canonical names and aliases', () => {
  assert.equal(findDogBreed('bichon frise')?.name, 'Bichon Frisé');
  assert.equal(findDogBreed('coton de tulear')?.name, 'Coton de Tulear');
});
