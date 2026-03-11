// FILE: app/api/taxi-distance/route.ts
import { NextResponse } from 'next/server';

type LatLng = { lat: number; lon: number };
type OsrmRouteResponse = {
  routes?: Array<{ distance?: number }>;
};
type TaxiDistancePostBody = { address?: string };

function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function geocode(address: string): Promise<LatLng | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', address);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'TenutaDelBarone/1.0 (taxi-distance)' },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.length) return null;

  return { lat: toNum(data[0].lat), lon: toNum(data[0].lon) };
}

async function routeDistanceKm(origin: LatLng, dest: LatLng): Promise<number | null> {
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}`
  );
  url.searchParams.set('overview', 'false');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return null;

  const data = (await res.json()) as OsrmRouteResponse;
  const meters = data?.routes?.[0]?.distance;

  if (typeof meters !== 'number' || !Number.isFinite(meters)) return null;

  return meters / 1000;
}

async function computeKmFromAddress(userAddress: string): Promise<NextResponse> {
  const addr = (userAddress ?? '').trim();
  if (!addr) {
    return NextResponse.json({ ok: false, error: 'Indirizzo taxi utente mancante.' }, { status: 400 });
  }

  const businessAddress = (process.env.TENUTADELBARONE_BUSINESS_ADDRESS ?? '').trim();
  if (!businessAddress) {
    return NextResponse.json(
      { ok: false, error: 'Indirizzo azienda mancante (TENUTADELBARONE_BUSINESS_ADDRESS in .env.local).' },
      { status: 400 }
    );
  }

  const [o, d] = await Promise.all([geocode(businessAddress), geocode(addr)]);

  if (!o) return NextResponse.json({ ok: false, error: 'Impossibile geocodificare indirizzo azienda.' }, { status: 200 });
  if (!d) return NextResponse.json({ ok: false, error: 'Impossibile geocodificare indirizzo taxi utente.' }, { status: 200 });

  const km = await routeDistanceKm(o, d);
  if (km == null) return NextResponse.json({ ok: false, error: 'Impossibile calcolare la distanza stradale.' }, { status: 200 });

  return NextResponse.json({ ok: true, km }, { status: 200 });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = (searchParams.get('userAddress') ?? '').trim();
    return await computeKmFromAddress(userAddress);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'Errore inatteso nel calcolo distanza taxi.' }, { status: 500 });
  }
}

// Compatibilità con la UI (FissaDataModal) che invia JSON via POST.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as TaxiDistancePostBody | null;
    const userAddress = String(body?.address ?? '').trim();
    return await computeKmFromAddress(userAddress);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'Errore inatteso nel calcolo distanza taxi.' }, { status: 500 });
  }
}
