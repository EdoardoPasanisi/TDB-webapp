import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { CUSTOMER_MEDIA_BUCKET } from '@/lib/media/config';
import { getCustomerMediaMimeTypeFromPath } from '@/lib/media/server';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    mediaId: string;
  }>;
};

type MediaContentRow = {
  id: string;
  user_id: string;
  storage_path: string;
  visible_until: string;
};

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) target.set(name, value);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const access = await requireRequestUser(request);
    const { mediaId } = await context.params;
    const normalizedMediaId = String(mediaId ?? '').trim();

    if (!normalizedMediaId) {
      return NextResponse.json({ ok: false, error: 'Media non valido.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('customer_media')
      .select('id, user_id, storage_path, visible_until')
      .eq('id', normalizedMediaId)
      .eq('user_id', access.userId)
      .gte('visible_until', new Date().toISOString())
      .maybeSingle();

    const media = (data ?? null) as MediaContentRow | null;
    if (error) throw new Error(error.message);
    if (!media) {
      return NextResponse.json({ ok: false, error: 'Media non trovato.' }, { status: 404 });
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(CUSTOMER_MEDIA_BUCKET)
      .createSignedUrl(media.storage_path, 60 * 10);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(signedError?.message ?? 'Non siamo riusciti a preparare il media.');
    }

    const upstreamHeaders = new Headers();
    const range = request.headers.get('range');
    if (range) upstreamHeaders.set('Range', range);

    const upstream = await fetch(signedData.signedUrl, {
      headers: upstreamHeaders,
      cache: 'no-store',
    });

    if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
      throw new Error(`Storage media request failed with status ${upstream.status}.`);
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', getCustomerMediaMimeTypeFromPath(media.storage_path));
    responseHeaders.set('Content-Disposition', 'inline');
    responseHeaders.set('Cache-Control', 'private, max-age=300');
    responseHeaders.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    copyHeader(upstream.headers, responseHeaders, 'content-length');
    copyHeader(upstream.headers, responseHeaders, 'content-range');
    copyHeader(upstream.headers, responseHeaders, 'etag');
    copyHeader(upstream.headers, responseHeaders, 'last-modified');

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { ok: false, error: humanizeErrorMessage(error, 'Non siamo riusciti a caricare il media.') },
      { status: 500 }
    );
  }
}
