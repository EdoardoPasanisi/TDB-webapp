export function extractRawErrorMessage(error: unknown, seen = new WeakSet<object>()): string {
  if (typeof error === 'string') return error.trim();
  if (typeof error === 'number' || typeof error === 'boolean') return String(error).trim();
  if (!error) return '';

  if (error instanceof Error) {
    return extractRawErrorMessage(error.message, seen);
  }

  if (Array.isArray(error)) {
    for (const item of error) {
      const raw = extractRawErrorMessage(item, seen);
      if (raw) return raw;
    }
    return '';
  }

  if (typeof error !== 'object') return '';
  if (seen.has(error as object)) return '';
  seen.add(error as object);

  const record = error as Record<string, unknown>;

  for (const key of ['message', 'error_description', 'error', 'details', 'hint', 'msg', 'description', 'cause']) {
    const raw = extractRawErrorMessage(record[key], seen);
    if (raw) return raw;
  }

  for (const value of Object.values(record)) {
    const raw = extractRawErrorMessage(value, seen);
    if (raw) return raw;
  }

  return '';
}

export function humanizeErrorMessage(
  error: unknown,
  fallback = 'Si è verificato un problema. Riprova.'
): string {
  const raw = extractRawErrorMessage(error);
  const normalizedFallback = String(fallback ?? '').trim() || 'Si è verificato un problema. Riprova.';
  if (!raw) return normalizeFallbackMessage(normalizedFallback);

  const clean = raw.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();

  const rules: Array<{ match: RegExp[]; message: string }> = [
    {
      match: [/invalid login credentials/i],
      message: 'Email o password non corrette.',
    },
    {
      match: [/user already registered/i, /email address .* already registered/i],
      message: 'Questa email risulta già registrata. Accedi oppure usa "Password dimenticata?".',
    },
    {
      match: [/password should be at least/i, /password is too short/i],
      message: 'La password è troppo corta. Inseriscine una più sicura.',
    },
    {
      match: [/unable to validate email address/i, /email address .* invalid/i, /invalid email/i],
      message: 'Inserisci un indirizzo email valido.',
    },
    {
      match: [/email not confirmed/i, /email_not_confirmed/i],
      message: 'Per accedere devi prima confermare la tua email.',
    },
    {
      match: [/rate limit/i, /too many requests/i, /too many attempts/i],
      message: 'Hai fatto troppi tentativi in poco tempo. Attendi qualche minuto e riprova.',
    },
    {
      match: [
        /jwt expired/i,
        /session not found/i,
        /auth session missing/i,
        /refresh token not found/i,
        /session from session_id/i,
        /sessione non valida/i,
        /sessione scaduta/i,
      ],
      message: 'La sessione è scaduta. Effettua di nuovo il login.',
    },
    {
      match: [/forbidden/i, /unauthorized/i, /not authorized/i, /violates row-level security/i],
      message: 'Non hai i permessi per eseguire questa operazione.',
    },
    {
      match: [/dog not found/i, /cane non trovato/i],
      message: 'Cane non trovato.',
    },
    {
      match: [/user not found/i, /utente non trovato/i],
      message: 'Utente non trovato.',
    },
    {
      match: [/booking not found/i, /prenotazione non trovata/i],
      message: 'Prenotazione non trovata.',
    },
    {
      match: [/missing dogid/i],
      message: 'Manca il riferimento del cane.',
    },
    {
      match: [/bookingid mancante/i, /bookingid.*non valido/i],
      message: 'Manca il riferimento della prenotazione oppure non è valido.',
    },
    {
      match: [/session_id mancante/i],
      message: 'Manca il riferimento del pagamento.',
    },
    {
      match: [/missing file/i],
      message: 'Seleziona un file prima di continuare.',
    },
    {
      match: [/failed to fetch/i, /networkerror/i, /network request failed/i, /load failed/i],
      message: 'Problema di connessione. Controlla la rete e riprova.',
    },
    {
      match: [/service_type mancante/i],
      message: 'Non siamo riusciti a caricare correttamente il servizio. Riprova.',
    },
    {
      match: [/database non aggiornato/i, /schema cache/i, /does not exist/i, /could not find the function/i],
      message: 'Serve un aggiornamento tecnico del sistema. Riprova più tardi.',
    },
    {
      match: [/duplicate key value/i, /already exists/i],
      message: 'Questi dati risultano già presenti. Controlla e riprova.',
    },
    {
      match: [/payload/i, /\buuid\b/i, /invalid input syntax/i],
      message: 'Alcuni dati inviati non sono corretti. Ricarica la pagina e riprova.',
    },
    {
      match: [/errore supabase/i, /supabase/i, /booking_dogs/i, /service_slot_bookings/i],
      message: 'Non siamo riusciti a recuperare i dati richiesti. Riprova.',
    },
    {
      match: [/unexpected error/i, /internal server error/i, /errore interno/i, /errore inatteso/i],
      message: 'Si è verificato un problema interno. Riprova tra poco.',
    },
    {
      match: [/\bmissing\b/i, /\brequired\b/i, /\binvalid\b/i, /\bnot found\b/i, /\bfailed\b/i],
      message: normalizeFallbackMessage(normalizedFallback),
    },
  ];

  for (const rule of rules) {
    if (rule.match.some((pattern) => pattern.test(clean))) {
      return rule.message;
    }
  }

  const technicalMarkers = [
    'supabase',
    'schema cache',
    'jwt',
    'uuid',
    'payload',
    'service_type',
    'booking_dogs',
    'service_slot_bookings',
    'row-level security',
    'unexpected error',
    'internal server error',
  ];

  if (technicalMarkers.some((marker) => lower.includes(marker))) {
    return normalizeFallbackMessage(normalizedFallback);
  }

  return clean;
}

function normalizeFallbackMessage(fallback: string): string {
  const lower = fallback.toLowerCase();
  if (lower.includes('unexpected error') || lower.includes('errore inatteso') || lower.includes('errore interno')) {
    return 'Si è verificato un problema interno. Riprova tra poco.';
  }
  if (lower.includes('failed') || lower.includes('errore richiesta')) {
    return 'Non siamo riusciti a completare l’operazione. Riprova.';
  }
  return fallback;
}
