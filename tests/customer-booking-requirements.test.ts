import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMissingRequiredCustomerBookingMessage,
  getMissingRequiredCustomerBookingFields,
} from '../lib/bookings/customerBookingRequirements';

test('getMissingRequiredCustomerBookingFields returns missing owner booking fields', () => {
  assert.deepEqual(
    getMissingRequiredCustomerBookingFields({
      first_name: 'Mario',
      last_name: '',
      phone: '  ',
    }),
    [
      'Cognome',
      'Numero di telefono',
      'Codice fiscale',
      'Residenza completa',
      'Documento di identità caricato',
    ]
  );
});

test('getMissingRequiredCustomerBookingFields accepts a complete owner profile', () => {
  assert.deepEqual(
    getMissingRequiredCustomerBookingFields({
      first_name: 'Mario',
      last_name: 'Rossi',
      phone: '3331234567',
      fiscal_code: 'RSSMRA80A01H501U',
      address_line: 'Via Roma 1',
      city: 'Roma',
      zip_code: '00100',
      province: 'RM',
      id_document_path: 'user/id-documents/file.pdf',
    }),
    []
  );
});

test('getMissingRequiredCustomerBookingFields accepts an uploaded identity document flag', () => {
  assert.deepEqual(
    getMissingRequiredCustomerBookingFields({
      first_name: 'Mario',
      last_name: 'Rossi',
      phone: '3331234567',
      fiscal_code: 'RSSMRA80A01H501U',
      address_line: 'Via Roma 1',
      city: 'Roma',
      zip_code: '00100',
      province: 'RM',
      id_document_path: null,
      has_id_document: true,
    }),
    []
  );
});

test('buildMissingRequiredCustomerBookingMessage formats a clear blocking message', () => {
  assert.equal(
    buildMissingRequiredCustomerBookingMessage(['Nome', 'Numero di telefono']),
    'Per completare la prenotazione devi compilare: Nome, Numero di telefono.'
  );
});
