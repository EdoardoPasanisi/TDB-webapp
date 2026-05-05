import type { TaxiDistanceBand, TaxiOption } from '@/types/booking';
import type { PerDogForm } from '@/lib/services/pensione/types';

export type SavePensioneBookingInput = {
  bookingId?: string | null;
  startDate: string;
  endDate: string;
  arrivalTime: string;
  departureTime: string;
  notes?: string | null;
  taxiOption: TaxiOption;
  taxiDistanceBand: TaxiDistanceBand;
  selectedDogIds: string[];
  perDogForm: Record<string, PerDogForm>;
};

export type SavePensioneBookingResult = {
  bookingId: string;
};

export async function savePensioneBooking(
  input: SavePensioneBookingInput
): Promise<SavePensioneBookingResult> {
  const response = await fetch('/api/pensione-bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = 'Errore nel salvataggio della prenotazione.';

    try {
      const json = (await response.clone().json()) as { error?: string };
      if (json?.error) message = json.error;
    } catch {}

    if (message === 'Errore nel salvataggio della prenotazione.') {
      try {
        const text = await response.text();
        if (text.trim()) message = text.trim();
      } catch {}
    }

    throw new Error(message);
  }

  return response.json() as Promise<SavePensioneBookingResult>;
}

export async function cancelPensioneBooking(bookingId: string): Promise<void> {
  const normalizedBookingId = String(bookingId ?? '').trim();
  if (!normalizedBookingId) {
    throw new Error('Prenotazione non valida.');
  }

  const response = await fetch('/api/pensione-bookings', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ bookingId: normalizedBookingId }),
  });

  if (!response.ok) {
    let message = 'Errore durante l’annullamento della prenotazione.';

    try {
      const json = (await response.clone().json()) as { error?: string };
      if (json?.error) message = json.error;
    } catch {}

    if (message === 'Errore durante l’annullamento della prenotazione.') {
      try {
        const text = await response.text();
        if (text.trim()) message = text.trim();
      } catch {}
    }

    throw new Error(message);
  }
}
