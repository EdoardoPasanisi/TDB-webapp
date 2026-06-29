import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  deletePensioneBlock,
  listPensioneBlocks,
  upsertPensioneBlock,
} from '@/lib/admin/pensioneBlocks';
import {
  sanitizeDateRangeInput,
  sanitizePensioneBlockDeleteInput,
  sanitizePensioneBlockInput,
} from '@/lib/admin/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fallbackDate(offsetDays = 0): string {
  const value = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = sanitizeDateRangeInput(
      searchParams.get('start') ?? fallbackDate(0),
      searchParams.get('end') ?? fallbackDate(60)
    );

    const items = await listPensioneBlocks({ startDate, endDate });
    return NextResponse.json({ items });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireStaffAccess(request, 'manage');

    const body = await request.json().catch(() => null);
    const input = sanitizePensioneBlockInput(body);
    const block = await upsertPensioneBlock({ ...input, createdBy: access.userId });

    return NextResponse.json(block);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');

    const body = await request.json().catch(() => null);
    const { blockId } = sanitizePensioneBlockDeleteInput(body);
    await deletePensioneBlock(blockId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
