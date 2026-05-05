import { NextResponse } from 'next/server';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import {
  getNotificationPreferencesForUser,
  upsertNotificationPreferencesForUser,
} from '@/lib/notifications/preferences';
import { humanizeErrorMessage } from '@/lib/errors/humanize';

type PatchBody = Partial<{
  booking_in_app: unknown;
  booking_email: unknown;
  document_in_app: unknown;
  document_email: unknown;
  chat_in_app: unknown;
  chat_email: unknown;
  media_in_app: unknown;
  media_email: unknown;
}>;

function sanitizeBooleanPatch(body: PatchBody) {
  const patch: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'boolean') {
      patch[key] = value;
    }
  }
  return patch;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const access = await requireRequestUser(request);
    const preferences = await getNotificationPreferencesForUser(access.userId);
    return NextResponse.json(preferences);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a caricare le preferenze notifiche.') },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireRequestUser(request);
    const body = (await request.json().catch(() => null)) as PatchBody | null;
    const patch = sanitizeBooleanPatch(body ?? {});
    const preferences = await upsertNotificationPreferencesForUser({
      userId: access.userId,
      patch,
    });
    return NextResponse.json(preferences);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: humanizeErrorMessage(error, 'Non siamo riusciti a salvare le preferenze notifiche.') },
      { status: 500 }
    );
  }
}
