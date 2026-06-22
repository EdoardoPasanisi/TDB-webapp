import { NextResponse } from 'next/server';
import { verifyStreamWebhook } from '@/lib/media/cloudflare';
import { markStreamVideoReady } from '@/lib/media/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cloudflare Stream chiama questo endpoint quando il transcoding di un video e completo.
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyStreamWebhook(rawBody, request.headers.get('webhook-signature'))) {
    return NextResponse.json({ ok: false, error: 'Firma webhook non valida.' }, { status: 401 });
  }

  let payload: {
    uid?: string;
    readyToStream?: boolean;
    duration?: number;
    thumbnail?: string;
    status?: { state?: string };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload non valido.' }, { status: 400 });
  }

  const uid = String(payload.uid ?? '').trim();
  const ready = Boolean(payload.readyToStream) || payload.status?.state === 'ready';

  if (uid && ready) {
    try {
      await markStreamVideoReady({
        streamUid: uid,
        durationSeconds: typeof payload.duration === 'number' && payload.duration > 0 ? payload.duration : null,
        thumbnailUrl: payload.thumbnail ?? null,
      });
    } catch (error) {
      console.error('Cloudflare webhook processing failed:', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
