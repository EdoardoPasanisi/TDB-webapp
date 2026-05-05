// FILE: app/api/taxi-distance/route.ts
import { NextResponse } from 'next/server';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LatLng = { lat: number; lon: number };
type OsrmRouteResponse = {
  routes?: Array<{ distance?: number }>;
};
type TaxiDistancePostBody = { address?: string };

const ADDRESS_MAX_LENGTH = 240;
const UPSTREAM_TIMEOUT_MS = 8_000;

function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAddress(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, ADDRESS_MAX_LENGTH);
}

function validateAddress(address: string): string | null {
  if (!address) return 'Indirizzo taxi utente mancante.';
  if (address.length < 6) return 'Indirizzo taxi utente troppo corto.';
  if (address.length > ADDRESS_MAX_LENGTH) return 'Indirizzo taxi utente troppo lungo.';
  return null;
}

async function fetchWithTimeout(input: string | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function geocode(address: string): Promise<LatLng | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', address);

  const res = await fetchWithTimeout(url.toString(), {
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

  const res = await fetchWithTimeout(url.toString(), { cache: 'no-store' });
  if (!res.ok) return null;

  const data = (await res.json()) as OsrmRouteResponse;
  const meters = data?.routes?.[0]?.distance;

  if (typeof meters !== 'number' || !Number.isFinite(meters)) return null;

  return meters / 1000;
}

async function computeKmFromAddress(userAddress: string): Promise<NextResponse> {
  const addr = normalizeAddress(userAddress);
  const addressError = validateAddress(addr);
  if (addressError) {
    return NextResponse.json({ ok: false, error: addressError }, { status: 400 });
  }

  const businessAddress = normalizeAddress(process.env.TENUTADELBARONE_BUSINESS_ADDRESS ?? '');
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

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Metodo non supportato. Usa POST per il calcolo distanza taxi.' },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  try {
    await requireRequestUser(req);

    const body = (await req.json().catch(() => null)) as TaxiDistancePostBody | null;
    const userAddress = normalizeAddress(String(body?.address ?? ''));
    return await computeKmFromAddress(userAddress);
  } catch (e) {
    if (e instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }

    console.error(e);
    return NextResponse.json({ ok: false, error: 'Errore inatteso nel calcolo distanza taxi.' }, { status: 500 });
  }
}
