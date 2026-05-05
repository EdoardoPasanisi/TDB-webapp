import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeDogCardVisibilityPatch,
  sanitizeDateRangeInput,
  sanitizeDogInput,
  sanitizeProfilePatch,
  sanitizeProfileCardPreferencesPatch,
  sanitizeSlotDeleteInput,
  sanitizeSlotInput,
  sanitizeStaffMemberInput,
  sanitizeStaffRoleUpdateInput,
} from '../lib/admin/validation';

test('sanitizeDateRangeInput returns normalized range', () => {
  assert.deepEqual(sanitizeDateRangeInput('2026-03-17', '2026-03-20'), {
    startDate: '2026-03-17',
    endDate: '2026-03-20',
  });
});

test('sanitizeDateRangeInput rejects reversed ranges', () => {
  assert.throws(
    () => sanitizeDateRangeInput('2026-03-20', '2026-03-17'),
    /La data finale deve essere uguale o successiva alla data iniziale\./
  );
});

test('sanitizeStaffRoleUpdateInput accepts empty role as access removal', () => {
  assert.equal(sanitizeStaffRoleUpdateInput(''), null);
});

test('sanitizeStaffMemberInput normalizes a valid staff payload', () => {
  assert.deepEqual(
    sanitizeStaffMemberInput({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      role: ' admin ',
      isActive: false,
    }),
    {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      role: 'ADMIN',
    }
  );
});

test('sanitizeSlotInput normalizes a valid slot payload', () => {
  const slot = sanitizeSlotInput({
    slotId: '550e8400-e29b-41d4-a716-446655440000',
    serviceType: ' asilo ',
    serviceVariant: ' full ',
    startAt: '2026-03-20T09:00:00.000Z',
    endAt: '2026-03-20T18:00:00.000Z',
    capacity: 4,
    notes: '  Mattina   intensa  ',
  });

  assert.deepEqual(slot, {
    slotId: '550e8400-e29b-41d4-a716-446655440000',
    serviceType: 'ASILO',
    serviceVariant: 'FULL',
    startAt: '2026-03-20T09:00:00.000Z',
    endAt: '2026-03-20T18:00:00.000Z',
    capacity: 4,
    notes: 'Mattina intensa',
  });
});

test('sanitizeSlotDeleteInput validates the slot id', () => {
  assert.deepEqual(sanitizeSlotDeleteInput({ slotId: '550e8400-e29b-41d4-a716-446655440000' }), {
    slotId: '550e8400-e29b-41d4-a716-446655440000',
  });
});

test('sanitizeSlotInput rejects invalid capacity', () => {
  assert.throws(
    () =>
      sanitizeSlotInput({
        serviceType: 'ASILO',
        startAt: '2026-03-20T09:00:00.000Z',
        endAt: '2026-03-20T18:00:00.000Z',
        capacity: 0,
      }),
    /Capienza slot non valida\./
  );
});

test('sanitizeDogInput deduplicates temperament values and normalizes optional fields', () => {
  const dog = sanitizeDogInput({
    name: '  Luna  ',
    breed: '  Golden Retriever ',
    size_category: 'grande',
    grooming_difficulty: '3',
    sex: 'female',
    microchip: ' 12345 ',
    birth_date: '2020-01-02',
    notes: '  Cane molto socievole  ',
    coat_color: ' oro ',
    temperament: [' Giocherellona ', 'Giocherellona', ' Tranquilla '],
    show_breed: true,
    show_sex: true,
    show_size: false,
    show_microchip: true,
    show_birth_date: false,
    show_notes: true,
    show_coat_color: false,
    show_temperament: true,
  });

  assert.deepEqual(dog, {
    name: 'Luna',
    breed: 'Golden Retriever',
    size_category: 'grande',
    grooming_difficulty: 3,
    sex: 'female',
    microchip: '12345',
    birth_date: '2020-01-02',
    notes: 'Cane molto socievole',
    coat_color: 'oro',
    temperament: ['Giocherellona', 'Tranquilla'],
    show_breed: true,
    show_sex: true,
    show_size: false,
    show_microchip: true,
    show_birth_date: false,
    show_notes: true,
    show_coat_color: false,
    show_temperament: true,
  });
});

test('sanitizeProfileCardPreferencesPatch requires explicit booleans for owner card prefs', () => {
  assert.deepEqual(
    sanitizeProfileCardPreferencesPatch({
      show_first_name_on_dog_card: true,
      show_last_name_on_dog_card: false,
      show_phone_on_dog_card: true,
      show_email_on_dog_card: false,
      show_address_on_dog_card: false,
      show_dog_address_on_dog_card: true,
    }),
    {
      show_first_name_on_dog_card: true,
      show_last_name_on_dog_card: false,
      show_phone_on_dog_card: true,
      show_email_on_dog_card: false,
      show_address_on_dog_card: false,
      show_dog_address_on_dog_card: true,
    }
  );
});

test('sanitizeProfilePatch accepts partial payloads without nulling omitted fields', () => {
  assert.deepEqual(
    sanitizeProfilePatch({
      first_name: '  Mario ',
      phone: ' 333 123 ',
    }),
    {
      first_name: 'Mario',
      phone: '333 123',
    }
  );
});

test('sanitizeDogCardVisibilityPatch requires explicit booleans for dog card prefs', () => {
  assert.deepEqual(
    sanitizeDogCardVisibilityPatch({
      show_breed: true,
      show_sex: true,
      show_size: false,
      show_microchip: false,
      show_birth_date: true,
      show_notes: false,
      show_coat_color: true,
      show_temperament: false,
    }),
    {
      show_breed: true,
      show_sex: true,
      show_size: false,
      show_microchip: false,
      show_birth_date: true,
      show_notes: false,
      show_coat_color: true,
      show_temperament: false,
    }
  );
});
