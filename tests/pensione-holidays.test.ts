import test from 'node:test';
import assert from 'node:assert/strict';
import { findHolidayTransitError, getClosedDayLabel, getHolidayName, listClosedDaysForYear } from '../lib/services/pensione/holidays';

test('riconosce festivi fissi e mobili', () => {
  assert.equal(getHolidayName('2026-12-25'), 'Natale');
  assert.equal(getHolidayName('2026-04-05'), 'Pasqua');
  assert.equal(getHolidayName('2026-04-06'), 'Pasquetta');
  assert.equal(getHolidayName('2027-03-29'), 'Pasquetta');
  assert.equal(getHolidayName('2026-10-04'), 'San Francesco');
  assert.equal(getHolidayName('2025-10-04'), null);
  assert.equal(getHolidayName('2026-12-24'), null);
});

test('consente soggiorni a cavallo dei festivi', () => {
  assert.equal(findHolidayTransitError('2026-12-20', '2026-12-28'), null);
});

test('blocca ingresso o uscita in un festivo', () => {
  assert.match(findHolidayTransitError('2026-12-25', '2026-12-28') ?? '', /portare il cane il 25\/12\/2026 \(Natale\)/);
  assert.match(findHolidayTransitError('2026-12-20', '2026-12-26') ?? '', /riprendere il cane il 26\/12\/2026/);
});

test('le eccezioni dello staff prevalgono sui festivi', () => {
  const overrides = [
    { date: '2026-12-26', closed: false, label: null },
    { date: '2026-12-24', closed: true, label: 'Vigilia di Natale' },
  ];
  assert.equal(findHolidayTransitError('2026-12-20', '2026-12-26', overrides), null);
  assert.match(findHolidayTransitError('2026-12-24', '2026-12-28', overrides) ?? '', /\(Vigilia di Natale\)/);
  assert.equal(getClosedDayLabel('2026-12-25', overrides), 'Natale');
});

test('calendario annuale per il gestionale', () => {
  const entries = listClosedDaysForYear(2026, [
    { date: '2026-12-26', closed: false, label: null },
    { date: '2026-12-24', closed: true, label: 'Vigilia' },
  ]);
  assert.equal(entries.find((e) => e.date === '2026-12-26')?.closed, false);
  assert.deepEqual(entries.find((e) => e.date === '2026-12-24'), {
    date: '2026-12-24',
    label: 'Vigilia',
    source: 'CUSTOM',
    closed: true,
  });
  assert.equal(entries.filter((e) => e.source === 'HOLIDAY').length, 13);
});
