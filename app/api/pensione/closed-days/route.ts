import { NextResponse } from 'next/server';
import { loadClosedDayOverrides } from '@/lib/services/pensione/closedDaysServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Eccezioni ai giorni di chiusura (festivi riaperti / chiusure aggiunte) per il form
// di prenotazione. I festivi di base li calcola il client da sé.
export async function GET() {
  try {
    const overrides = await loadClosedDayOverrides();
    return NextResponse.json({ overrides });
  } catch {
    return NextResponse.json({ error: 'Giorni di chiusura non disponibili.' }, { status: 500 });
  }
}
