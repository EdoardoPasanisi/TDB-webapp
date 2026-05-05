import test from 'node:test';
import assert from 'node:assert/strict';

import { humanizeErrorMessage } from '../lib/errors/humanize';

test('humanizeErrorMessage traduce credenziali non valide', () => {
  assert.equal(
    humanizeErrorMessage('Invalid login credentials'),
    'Email o password non corrette.'
  );
});

test('humanizeErrorMessage traduce errori di permessi', () => {
  assert.equal(
    humanizeErrorMessage('Forbidden'),
    'Non hai i permessi per eseguire questa operazione.'
  );
});

test('humanizeErrorMessage traduce riferimenti prenotazione mancanti', () => {
  assert.equal(
    humanizeErrorMessage('bookingId mancante o non valido.'),
    'Manca il riferimento della prenotazione oppure non è valido.'
  );
});

test('humanizeErrorMessage mantiene messaggi gia comprensibili', () => {
  assert.equal(
    humanizeErrorMessage('Seleziona almeno un cane per la prenotazione.'),
    'Seleziona almeno un cane per la prenotazione.'
  );
});

test('humanizeErrorMessage usa un fallback italiano per errori di rete', () => {
  assert.equal(
    humanizeErrorMessage('Failed to fetch', 'Non siamo riusciti a caricare i dati richiesti.'),
    'Problema di connessione. Controlla la rete e riprova.'
  );
});
