import { NextResponse } from 'next/server';
import { loadAccommodationCatalog } from '@/lib/services/pensione/accommodationsServer';

// Catalogo alloggi per il form di prenotazione: solo quelli attivi, nessun dato riservato.
export async function GET() {
  try {
    const catalog = await loadAccommodationCatalog();
    return NextResponse.json({ items: catalog.filter((item) => item.active) });
  } catch {
    return NextResponse.json({ error: 'Alloggi non disponibili.' }, { status: 500 });
  }
}
