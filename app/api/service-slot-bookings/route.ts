import { NextResponse } from 'next/server';
import {
  RouteAuthError,
  createRequestSupabaseClient,
  requireRequestUser,
  routeAuthErrorResponse,
} from '@/lib/server/routeAuth';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import {
  buildMissingRequiredCustomerBookingMessage,
  getMissingRequiredCustomerBookingFields,
  type CustomerBookingRequirementProfile,
} from '@/lib/bookings/customerBookingRequirements';
import { createManageStaffNotifications } from '@/lib/admin/notifications';
import { formatPersonName } from '@/lib/admin/utils';
import { getServiceLabel, type ServiceType, type ServiceVariant } from '@/types/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SERVICE_TYPES = new Set<ServiceType>(['PENSIONE', 'ASILO', 'ADDESTRAMENTO', 'CONSULENZA']);
const SERVICE_VARIANTS = new Set<ServiceVariant>(['SESSION_60', 'HALF', 'FULL']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUuid(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeNullableUuid(value: unknown): string | null {
  if (value == null || String(value).trim() === '') return null;
  return normalizeUuid(value);
}

function normalizeInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseVariant(value: unknown): ServiceVariant | null {
  if (value == null || String(value).trim() === '') return null;
  const normalized = String(value).trim() as ServiceVariant;
  return SERVICE_VARIANTS.has(normalized) ? normalized : null;
}

function parseDogIds(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;

  const ids = Array.from(
    new Set(value.map((entry) => normalizeUuid(entry)).filter((entry): entry is string => Boolean(entry)))
  );

  return ids.length > 0 ? ids : null;
}

function readErrorMessage(error: unknown, fallback: string): string {
  return humanizeErrorMessage(error, fallback);
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const supabase = await createRequestSupabaseClient(request);
    const body = await request.json().catch(() => null);

    if (!isPlainObject(body)) {
      return NextResponse.json({ error: 'Payload prenotazione slot non valido.' }, { status: 400 });
    }

    const slotId = normalizeUuid(body.slotId);
    const passId = normalizeNullableUuid(body.passId);
    const serviceType = String(body.serviceType ?? '').trim() as ServiceType;
    const serviceVariant = parseVariant(body.serviceVariant);
    const dogIds = parseDogIds(body.dogIds);
    const creditsSpent = normalizeInteger(body.creditsSpent);
    const taxiEnabled = typeof body.taxiEnabled === 'boolean' ? body.taxiEnabled : null;
    const taxiDistanceKm = normalizeNonNegativeNumber(body.taxiDistanceKm);
    const taxiPriceEur = normalizeNonNegativeNumber(body.taxiPriceEur);
    const notes = body.notes == null ? null : String(body.notes);

    if (!slotId || !SERVICE_TYPES.has(serviceType) || creditsSpent === null || creditsSpent < 1 || taxiEnabled === null) {
      return NextResponse.json({ error: 'Dati prenotazione slot non validi.' }, { status: 400 });
    }

    const [
      { data: profile, error: profileError },
      { data: identityDocuments, error: identityDocumentsError },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('first_name, last_name, phone, fiscal_code, address_line, city, zip_code, province, id_document_path')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_documents')
        .select('side, path')
        .eq('user_id', userId)
        .eq('kind', 'ID_DOCUMENT')
        .in('status', ['PENDING', 'ACCEPTED'])
        .order('created_at', { ascending: false }),
    ]);

    if (profileError || identityDocumentsError) {
      return NextResponse.json(
        { error: 'Impossibile verificare i dati del profilo.' },
        { status: 500 }
      );
    }

    // Servono entrambi i lati (fronte + retro). Le righe legacy (side NULL)
    // sono trattate come fronte (vedi migration di backfill).
    const idDocRows = (identityDocuments ?? []) as Array<{ side?: string | null; path?: string | null }>;
    const hasIdFront = idDocRows.some(
      (row) => (row.side ?? 'FRONT') === 'FRONT' && String(row.path ?? '').trim().length > 0
    );
    const hasIdBack = idDocRows.some(
      (row) => row.side === 'BACK' && String(row.path ?? '').trim().length > 0
    );
    const hasUploadedIdentityDocument = hasIdFront && hasIdBack;

    const missingRequiredFields = getMissingRequiredCustomerBookingFields(
      {
        ...((profile ?? {}) as CustomerBookingRequirementProfile),
        has_id_document: hasUploadedIdentityDocument,
      }
    );

    if (missingRequiredFields.length > 0) {
      return NextResponse.json(
        { error: buildMissingRequiredCustomerBookingMessage(missingRequiredFields) },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('book_service_slot', {
      p_user_id: userId,
      p_slot_id: slotId,
      p_pass_id: passId,
      p_service_type: serviceType,
      p_service_variant: serviceVariant,
      p_dog_ids: dogIds,
      p_credits_spent: creditsSpent,
      p_taxi_enabled: taxiEnabled,
      p_taxi_distance_km: taxiDistanceKm,
      p_taxi_price_eur: taxiPriceEur,
      p_notes: notes,
    });

    if (error) {
      return NextResponse.json({ error: humanizeErrorMessage(error, 'Non siamo riusciti a completare la prenotazione del servizio.') }, { status: 400 });
    }

    const bookingId = String(data);

    try {
      await createManageStaffNotifications({
        type: 'BOOKING_ACTION_REQUIRED',
        title: 'Nuova prenotazione servizio',
        body: `${formatPersonName(profile?.first_name ?? null, profile?.last_name ?? null)} ha prenotato ${getServiceLabel(serviceType, serviceVariant ?? null)}.`,
        data: {
          href: '/admin?tab=services',
          adminTab: 'services',
          bookingId,
        },
      });
    } catch (notificationError) {
      console.error('Admin booking notification failed:', notificationError);
    }

    return NextResponse.json({ bookingId });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per prenotare questo servizio.'),
      });
    }

    return NextResponse.json(
      { error: readErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const supabase = await createRequestSupabaseClient(request);
    const body = await request.json().catch(() => null);

    if (!isPlainObject(body)) {
      return NextResponse.json({ error: 'Payload cancellazione slot non valido.' }, { status: 400 });
    }

    const bookingId = normalizeUuid(body.bookingId);
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId mancante o non valido.' }, { status: 400 });
    }

    const { error } = await supabase.rpc('cancel_service_slot_booking', {
      p_user_id: userId,
      p_booking_id: bookingId,
    });

    if (error) {
      return NextResponse.json({ error: humanizeErrorMessage(error, 'Non siamo riusciti ad annullare la prenotazione del servizio.') }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per modificare questa prenotazione.'),
      });
    }

    return NextResponse.json(
      { error: readErrorMessage(error, 'Si è verificato un problema interno. Riprova tra poco.') },
      { status: 500 }
    );
  }
}
