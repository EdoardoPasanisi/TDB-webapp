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
import {
  DEFAULT_ACCOMMODATIONS as catalog,
  accommodationOptionsForSpecies,
  reconcilePerDogAccommodations,
} from '../lib/services/pensione/accommodations';

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
      size_category: 'media',
      grooming_difficulty: 2,
    }),
    35
  );

  assert.equal(
    computeGroomingPriceForDog({
      size_category: null,
      grooming_difficulty: null,
    }),
    35
  );
});

test('computePricing applies multi-dog tiered accommodation rates, extras and taxi correctly', () => {
  const pricing = computePricing({
    catalog,
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
  // Lo sconto multi-cane è ora incorporato nelle tariffe a scaglioni: nessuno sconto %.
  assert.equal(pricing.discountPercent, 0);
  // 2 cani: BOX 54/2 = 27/cane, CHALET 60/2 = 30/cane → (27 + 30) × 2 giorni = 114
  assert.equal(pricing.alloggioTotalFull, 114);
  assert.equal(pricing.alloggioTotalDiscounted, 114);
  // extras dog-1: toelettatura 35 + vaccino 70 + ricerca olfattiva 1×20 + passeggiate 2×15 = 155
  assert.equal(pricing.extrasTotal, 225);
  assert.equal(pricing.taxiPrice, 70);
  assert.equal(pricing.totalPrice, 339);
});

test('computePricing caps the multi-dog discount tier at 3 dogs', () => {
  const makeDog = (id: string) => ({
    id,
    name: id,
    photo_path: null,
    updated_at: null,
    size_category: 'media' as const,
    grooming_difficulty: 2 as const,
  });
  const boxForm: PerDogForm = {
    accommodationType: 'BOX',
    grooming: false,
    vaccine: false,
    trackingSessions: 0,
    fitnessSessions: 0,
    walkSessions: 0,
    trekkingSessions: 0,
    therapy: 'NO',
    therapyNotes: '',
  };

  const fourDogs = computePricing({
    catalog,
    selectedDogIds: ['d1', 'd2', 'd3', 'd4'],
    daysCount: 1,
    dogs: [makeDog('d1'), makeDog('d2'), makeDog('d3'), makeDog('d4')],
    perDogForm: { d1: boxForm, d2: boxForm, d3: boxForm, d4: boxForm },
    taxiOption: 'NONE',
    taxiDistanceBand: 'ENTRO_40',
  });

  // BOX 3+ cani = 81/giorno → 27/cane; oltre il 3° resta 27/cane → 4 × 27 = 108
  assert.equal(fourDogs.alloggioTotalFull, 108);
  assert.equal(fourDogs.totalPrice, 108);
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

  // Climatizzazione accesa dal gestionale sul Box con giardino: si applica da sola.
  const climateCatalog = catalog.map((item) =>
    item.key === 'BOX_GARDEN' ? { ...item, climateActive: true } : item
  );

  const totals = computePerDogTotals({
    catalog: climateCatalog,
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
    totalDogs: 1,
  });

  // extras: climatizzazione 3×3 + toelettatura 50 + vaccino 70 + ricerca olfattiva 1×20
  // + fitness 2×25 + passeggiata 1×15 + trekking 1×30 = 244
  assert.deepEqual(totals, {
    accommodation_price_per_day: 40,
    accommodation_subtotal: 120,
    climate_price_per_day: 3,
    climate_subtotal: 9,
    extras_subtotal: 244,
    per_dog_total: 364,
    grooming_price: 50,
  });

  // Con la climatizzazione spenta non c'è supplemento.
  const noClimate = computePerDogTotals({
    catalog,
    dog: { id: 'dog-1', name: 'Milo', photo_path: null, updated_at: null, size_category: 'grande', grooming_difficulty: 3 },
    form,
    daysCount: 3,
    totalDogs: 1,
  });
  assert.equal(noClimate.climate_subtotal, 0);
  assert.equal(noClimate.per_dog_total, 355);

  assert.deepEqual(buildExtrasPayload(form, climateCatalog), {
    grooming: true,
    vaccine: true,
    trackingSessions: 1,
    fitnessSessions: 2,
    walkSessions: 1,
    trekkingSessions: 1,
    therapyActive: true,
    therapyNotes: 'Controllare zampa posteriore',
    climate: true,
    climatePricePerDay: 3,
    accommodationLabel: 'Box con giardino',
  });
});

test('computePerDogTotals keeps stored rates when recalculating an existing booking', () => {
  const form: PerDogForm = {
    accommodationType: 'BOX',
    grooming: false,
    vaccine: false,
    trackingSessions: 0,
    fitnessSessions: 0,
    walkSessions: 0,
    trekkingSessions: 0,
    therapy: 'NO',
    therapyNotes: '',
  };
  const dog = {
    id: 'dog-1',
    name: 'Milo',
    photo_path: null,
    updated_at: null,
    size_category: 'media' as const,
    grooming_difficulty: 2 as const,
  };

  // Prenotazione salvata a 28€/g + 2€/g di clima: il catalogo nuovo (30, clima spento) non la tocca.
  const totals = computePerDogTotals({
    catalog,
    dog,
    form,
    daysCount: 2,
    totalDogs: 1,
    stored: { accommodationPricePerDay: 28, climatePricePerDay: 2 },
  });
  assert.equal(totals.accommodation_subtotal, 56);
  assert.equal(totals.climate_subtotal, 4);
  assert.equal(totals.per_dog_total, 60);
});

test('accommodation catalog: archived entries are not bookable and forms get realigned', () => {
  const edited = catalog.map((item) => (item.key === 'BOX' ? { ...item, active: false } : item));

  assert.ok(!accommodationOptionsForSpecies(edited, 'DOG').some((item) => item.key === 'BOX'));
  assert.deepEqual(
    accommodationOptionsForSpecies(edited, 'CAT').map((item) => item.key),
    ['CATTERY']
  );
  assert.deepEqual(accommodationOptionsForSpecies(edited, 'OTHER'), []);

  const forms = { a: { accommodationType: 'BOX' }, c: { accommodationType: 'HOTEL' } };
  const next = reconcilePerDogAccommodations(edited, [{ id: 'a' }, { id: 'c' }], forms);
  assert.deepEqual(next.a, { accommodationType: 'BOX_GARDEN' });
  assert.equal(next.c, forms.c);
  // Nessun cambiamento → stesso oggetto (niente render inutili).
  const unchanged = { c: forms.c };
  assert.equal(reconcilePerDogAccommodations(edited, [{ id: 'c' }], unchanged), unchanged);
});
