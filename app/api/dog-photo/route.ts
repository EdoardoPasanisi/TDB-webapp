// FILE: app/api/dog-photo/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type DogRow = {
  id: string;
  owner_id: string;
  is_active: boolean | null;
  photo_path: string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function guessExtFromMimeOrName(file: File): string {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  if (byType[file.type]) return byType[file.type];

  const m = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] ?? '';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;

  return 'jpg';
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase env.' }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing Authorization bearer token.' }, { status: 401 });
    }

    const form = await req.formData();
    const dogId = String(form.get('dogId') ?? '').trim();
    const file = form.get('file');

    if (!dogId) {
      return NextResponse.json({ error: 'Missing dogId.' }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
    }

    // Client admin (bypassa RLS) + verifica token utente
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // Verifica JWT -> user id
    const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }
    const userId = userData.user.id;

    // Verifica ownership cane
    const { data: dogData, error: dogErr } = await admin
      .from('dogs')
      .select('id, owner_id, is_active, photo_path')
      .eq('id', dogId)
      .maybeSingle();
    const dogRow = (dogData ?? null) as DogRow | null;

    if (dogErr) {
      return NextResponse.json({ error: dogErr.message }, { status: 400 });
    }
    if (!dogRow || dogRow.is_active === false) {
      return NextResponse.json({ error: 'Dog not found.' }, { status: 404 });
    }
    if (dogRow.owner_id !== userId) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Upload su storage con service role (no RLS)
    const ext = guessExtFromMimeOrName(file);
    const path = `${userId}/${dogId}.${ext}`;
    // Se l'estensione cambia (es. da .png a .jpg), rimuoviamo il vecchio file
    const prevPath = dogRow.photo_path;
    if (prevPath && prevPath !== path) {
        await admin.storage.from('dog-images').remove([prevPath]).catch(() => undefined);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await admin.storage.from('dog-images').upload(path, bytes, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
    });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // Salva photo_path sul cane
    const { error: updErr } = await admin
      .from('dogs')
      .update({ photo_path: path, updated_at: new Date().toISOString() })
      .eq('id', dogId)
      .eq('owner_id', userId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, path }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e, 'Unexpected error.') }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase env.' }, { status: 500 });
    }
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = m?.[1];
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing Authorization bearer token.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as null | { dogId?: string };
    const dogId = String(body?.dogId ?? '').trim();
    if (!dogId) {
      return NextResponse.json({ error: 'Missing dogId.' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }
    const userId = userData.user.id;

    const { data: dogData, error: dogErr } = await admin
      .from('dogs')
      .select('id, owner_id, is_active, photo_path')
      .eq('id', dogId)
      .maybeSingle();
    const dogRow = (dogData ?? null) as DogRow | null;

    if (dogErr) return NextResponse.json({ error: dogErr.message }, { status: 400 });
    if (!dogRow || dogRow.is_active === false) return NextResponse.json({ error: 'Dog not found.' }, { status: 404 });
    if (dogRow.owner_id !== userId) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    const photoPath = dogRow.photo_path;

    if (photoPath) {
      const { error: rmErr } = await admin.storage.from('dog-images').remove([photoPath]);
      if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 400 });
    }

    const { error: updErr } = await admin
      .from('dogs')
      .update({ photo_path: null, updated_at: new Date().toISOString() })
      .eq('id', dogId)
      .eq('owner_id', userId);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e, 'Unexpected error.') }, { status: 500 });
  }
}
