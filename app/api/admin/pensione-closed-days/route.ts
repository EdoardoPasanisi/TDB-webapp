import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  deleteClosedDayOverride,
  loadClosedDayOverrides,
  upsertClosedDayOverride,
} from '@/lib/services/pensione/closedDaysServer';
import { listClosedDaysForYear } from '@/lib/services/pensione/holidays';
import { sanitizeClosedDayDeleteInput, sanitizeClosedDayInput } from '@/lib/admin/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Calendario giorni di chiusura di un anno: festivi (chiusi di default) + giorni aggiunti.
export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const rawYear = Number(searchParams.get('year'));
    const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : new Date().getFullYear();

    const overrides = await loadClosedDayOverrides({ fromYear: year });
    return NextResponse.json({ year, items: listClosedDaysForYear(year, overrides) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

// Chiude (closed=true, anche giorni non festivi) o riapre (closed=false) un giorno.
export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess(request, 'manage');
    const input = sanitizeClosedDayInput(await request.json().catch(() => null));
    await upsertClosedDayOverride({ ...input, createdBy: access.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

// Toglie l'eccezione: il giorno torna come da calendario (festivo = chiuso, altrimenti aperto).
export async function DELETE(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');
    const { date } = sanitizeClosedDayDeleteInput(await request.json().catch(() => null));
    await deleteClosedDayOverride(date);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
