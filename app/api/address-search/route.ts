import { NextResponse } from 'next/server';
import type { AddressSuggestion } from '@/lib/address/addressSearch';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NominatimAddress = Record<string, string | undefined>;

type NominatimSearchItem = {
  display_name?: string;
  address?: NominatimAddress;
};

const QUERY_MIN_LENGTH = 3;
const QUERY_MAX_LENGTH = 160;
const SEARCH_LIMIT = 5;
const UPSTREAM_TIMEOUT_MS = 8_000;

function normalizeQuery(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, QUERY_MAX_LENGTH);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function buildAddressLine(address: NominatimAddress, displayName?: string): string {
  const road = firstNonEmpty(
    address.road,
    address.pedestrian,
    address.footway,
    address.residential,
    address.path,
    address.cycleway
  );
  const houseNumber = firstNonEmpty(address.house_number);
  const fallback = String(displayName ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0] ?? '';

  const line = [road, houseNumber].filter(Boolean).join(' ').trim();
  return line || fallback;
}

function extractCity(address: NominatimAddress): string {
  return firstNonEmpty(
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.city_district,
    address.suburb,
    address.hamlet
  );
}

function extractProvince(address: NominatimAddress): string {
  for (const value of Object.values(address)) {
    const normalized = String(value ?? '').trim().toUpperCase();
    const match = normalized.match(/\bIT-([A-Z]{2})\b/);
    if (match?.[1]) return match[1];
  }

  return '';
}

function mapSuggestion(item: NominatimSearchItem): AddressSuggestion | null {
  const address = item.address ?? {};
  const dog_address_line = buildAddressLine(address, item.display_name);
  const dog_city = extractCity(address);
  const dog_zip_code = firstNonEmpty(address.postcode);
  const dog_province = extractProvince(address);

  if (!dog_address_line) return null;

  const labelParts = [
    dog_address_line,
    [dog_zip_code, dog_city].filter(Boolean).join(' ').trim(),
    dog_province ? `(${dog_province})` : '',
  ].filter(Boolean);

  return {
    label: labelParts.join(', '),
    dog_address_line,
    dog_city,
    dog_zip_code,
    dog_province,
  };
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

async function searchItalianAddresses(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(SEARCH_LIMIT));
  url.searchParams.set('dedupe', '1');
  url.searchParams.set('countrycodes', 'it');
  url.searchParams.set('accept-language', 'it');
  url.searchParams.set('q', query);

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      'User-Agent': 'TenutaDelBarone/1.0 (address-search)',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Ricerca indirizzo temporaneamente non disponibile.');
  }

  const payload = (await response.json()) as NominatimSearchItem[];
  const unique = new Set<string>();

  return payload
    .map(mapSuggestion)
    .filter((item): item is AddressSuggestion => {
      if (!item) return false;
      const key = [
        item.dog_address_line,
        item.dog_city,
        item.dog_zip_code,
        item.dog_province,
      ].join('|');
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    });
}

export async function GET(request: Request) {
  try {
    await requireRequestUser(request);

    const { searchParams } = new URL(request.url);
    const query = normalizeQuery(searchParams.get('q') ?? '');

    if (query.length < QUERY_MIN_LENGTH) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200 });
    }

    const items = await searchItalianAddresses(query);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error(error);
    return NextResponse.json(
      { ok: false, error: 'Ricerca indirizzo non disponibile in questo momento.' },
      { status: 500 }
    );
  }
}
