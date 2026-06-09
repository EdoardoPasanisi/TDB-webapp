import test from 'node:test';
import assert from 'node:assert/strict';

import type { PerDogForm } from '../lib/services/pensione/types';
import {
  buildExtrasPayload,
  computeDaysCount,
  computeGroomingPriceForDog,
  computePerDogTotals,
  computePricing,
  validateTimeWindow,
} from '../lib/services/pensione/utils';

test('validateTimeWindow accepts only supported booking hours', () => {
  assert.equal(validateTimeWindow('Arrivo', '09:00'), null);
  assert.match(String(validateTimeWindow('Arrivo', '14:00')), /Arrivo deve essere tra 9–13 o 15–18\./);
});

test('computeDaysCount excludes departure day for morning pickup', () => {
  assert.equal(computeDaysCount('2026-03-17', '2026-03-18', '10:00'), 1);
  assert.equal(computeDaysCount('2026-03-17', '2026-03-18', '16:00'), 2);
});

test('computeGroomingPriceForDog uses robust defaults and rounds to clean price steps', () => {
  assert.equal(
    computeGroomingPriceForDog({
      id: 'dog-1',
      name: 'Milo',
      photo_path: null,
      updated_at: null,
      size_category: 'media',
      grooming_difficulty: 2,
    }),
    35
  );

  assert.equal(
    computeGroomingPriceForDog({
      id: 'dog-2',
      name: 'Penny',
      photo_path: null,
      updated_at: null,
      size_category: null,
      grooming_difficulty: null,
    }),
    35
  );
});

test('computePricing applies dog discount, extras and taxi correctly', () => {
  const pricing = computePricing({
    selectedDogIds: ['dog-1', 'dog-2'],
    daysCount: 2,
    dogs: [
      {
        id: 'dog-1',
        name: 'Milo',
        photo_path: null,
        updated_at: null,
        size_category: 'media',
        grooming_difficulty: 2,
      },
      {
        id: 'dog-2',
        name: 'Penny',
        photo_path: null,
        updated_at: null,
        size_category: 'toy',
        grooming_difficulty: 1,
      },
    ],
    perDogForm: {
      'dog-1': {
        accommodationType: 'BOX',
        grooming: true,
        vaccine: true,
        trackingSessions: 1,
        fitnessSessions: 0,
        walkSessions: 2,
        trekkingSessions: 0,
        therapy: 'NO',
        therapyNotes: '',
      },
      'dog-2': {
        accommodationType: 'CHALET',
        grooming: false,
        vaccine: false,
        trackingSessions: 0,
        fitnessSessions: 0,
        walkSessions: 0,
        trekkingSessions: 0,
        therapy: '',
        therapyNotes: '',
      },
    },
    taxiOption: 'ROUND_TRIP',
    taxiDistanceBand: 'OLTRE_40',
  });

  assert.equal(pricing.dogsCount, 2);
  assert.equal(pricing.discountPercent, 15);
  assert.equal(pricing.alloggioTotalFull, 126);
  assert.ok(Math.abs(pricing.alloggioTotalDiscounted - 107.1) < 1e-9);
  // extras dog-1: toelettatura 35 + vaccino 70 + ricerca olfattiva 1×20 + passeggiate 2×15 = 155
  assert.equal(pricing.extrasTotal, 225);
  assert.equal(pricing.taxiPrice, 70);
  assert.ok(Math.abs(pricing.totalPrice - 332.1) < 1e-9);
});

test('computePerDogTotals and buildExtrasPayload keep per-dog bookkeeping aligned', () => {
  const form: PerDogForm = {
    accommodationType: 'BOX_GARDEN',
    grooming: true,
    vaccine: true,
    trackingSessions: 1,
    fitnessSessions: 2,
    walkSessions: 1,
    trekkingSessions: 1,
    therapy: 'YES',
    therapyNotes: 'Controllare zampa posteriore',
  };

  const totals = computePerDogTotals({
    dog: {
      id: 'dog-1',
      name: 'Milo',
      photo_path: null,
      updated_at: null,
      size_category: 'grande',
      grooming_difficulty: 3,
    },
    form,
    daysCount: 3,
  });

  // extras: toelettatura 50 + vaccino 70 + ricerca olfattiva 1×20 + fitness 2×25 + passeggiata 1×15 + trekking 1×30 = 235
  assert.deepEqual(totals, {
    accommodation_price_per_day: 35,
    accommodation_subtotal: 105,
    extras_subtotal: 235,
    per_dog_total: 340,
    grooming_price: 50,
  });

  assert.deepEqual(buildExtrasPayload(form), {
    grooming: true,
    vaccine: true,
    trackingSessions: 1,
    fitnessSessions: 2,
    walkSessions: 1,
    trekkingSessions: 1,
    therapyActive: true,
    therapyNotes: 'Controllare zampa posteriore',
  });
});
