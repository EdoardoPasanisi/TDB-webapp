import { NextResponse } from 'next/server';
import { deleteExpiredMedia } from '@/lib/media/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron invia automaticamente "Authorization: Bearer <CRON_SECRET>".
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (request.headers.get('authorization') ?? '') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato.' }, { status: 401 });
  }

  try {
    const result = await deleteExpiredMedia();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cleanup fallito.' },
      { status: 500 }
    );
  }
}
