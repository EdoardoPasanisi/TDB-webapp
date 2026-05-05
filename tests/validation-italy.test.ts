import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidItalianFiscalCode,
  isValidMicrochip,
  sanitizeFiscalCode,
  sanitizeMicrochip,
} from '../lib/validation/italy';

test('sanitizeFiscalCode and sanitizeMicrochip remove spaces and normalize casing', () => {
  assert.equal(sanitizeFiscalCode(' rss mra 85m01 h501u '), 'RSSMRA85M01H501U');
  assert.equal(sanitizeMicrochip(' 123 456 789012345 '), '123456789012345');
});

test('isValidItalianFiscalCode rejects malformed values', () => {
  assert.equal(isValidItalianFiscalCode(''), false);
  assert.equal(isValidItalianFiscalCode('RSSMRA85M01H501X'), false);
});

test('isValidMicrochip accepts only 15 digits', () => {
  assert.equal(isValidMicrochip('123456789012345'), true);
  assert.equal(isValidMicrochip('12345'), false);
  assert.equal(isValidMicrochip('ABCDEFGHIJKLMNO'), false);
});
