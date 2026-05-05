import test from 'node:test';
import assert from 'node:assert/strict';

import { getServiceSlotDogIds, mapServiceSlotDogs } from '../lib/services/serviceSlotDogs';

test('getServiceSlotDogIds merges legacy and new fields without duplicates', () => {
  assert.deepEqual(
    getServiceSlotDogIds({
      dog_ids: [' dog-1 ', 'dog-2', 'dog-1'],
      dog_id: ' dog-2 ',
    }),
    ['dog-1', 'dog-2']
  );
});

test('mapServiceSlotDogs preserves booking order and skips missing dogs', () => {
  const dogMap = new Map([
    ['dog-2', { id: 'dog-2', name: 'Milo', breed: 'Labrador' }],
    ['dog-1', { id: 'dog-1', name: 'Luna', breed: 'Golden Retriever' }],
  ]);

  assert.deepEqual(
    mapServiceSlotDogs(
      {
        dog_ids: ['dog-2', 'dog-3'],
        dog_id: 'dog-1',
      },
      dogMap
    ),
    [
      { id: 'dog-2', name: 'Milo', breed: 'Labrador' },
      { id: 'dog-1', name: 'Luna', breed: 'Golden Retriever' },
    ]
  );
});
