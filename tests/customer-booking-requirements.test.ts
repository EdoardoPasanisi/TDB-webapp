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

test('buildMissingRequiredCustomerBookingMessage formats a clear blocking message', () => {
  assert.equal(
    buildMissingRequiredCustomerBookingMessage(['Nome', 'Numero di telefono']),
    'Per completare la prenotazione devi compilare: Nome, Numero di telefono.'
  );
});
