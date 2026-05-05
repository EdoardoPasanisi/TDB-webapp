import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatTemperamentsForDisplay,
  genderedTemperamentLabel,
} from '../lib/dogs/dogDisplay';

test('genderedTemperamentLabel applies female overrides and phrase rules', () => {
  assert.equal(genderedTemperamentLabel('giocherellone', 'female'), 'Giocherellona');
  assert.equal(genderedTemperamentLabel('Buono con persone', 'female'), 'Buona con persone');
  assert.equal(genderedTemperamentLabel('Sicuro in acqua', 'female'), 'Sicura in acqua');
});

test('formatTemperamentsForDisplay trims, filters and genders temperament labels', () => {
  assert.deepEqual(
    formatTemperamentsForDisplay(['  Buono con persone  ', '', 'giocherellone'], 'female'),
    ['Buona con persone', 'Giocherellona']
  );
});
