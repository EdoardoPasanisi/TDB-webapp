import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { randomBytes } from 'crypto';
import { requireRequestUser, RouteAuthError } from '@/lib/server/routeAuth';

async function generateUniquePublicId(dogId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomBytes(8).toString('hex');
    const { data, error } = await supabaseAdmin
      .from('dogs')
      .update({ public_id: candidate })
      .eq('id', dogId)
      .is('public_id', null)
      .select('public_id')
      .maybeSingle();

    if (error) continue;
    if (data?.public_id) return data.public_id;
  }

  const { data: current } = await supabaseAdmin
    .from('dogs')
    .select('public_id')
    .eq('id', dogId)
    .maybeSingle();

  if (current?.public_id) return current.public_id;
  throw new Error('Errore nel salvataggio del public_id.');
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireRequestUser(req);

    const body = await req.json().catch(() => null);

    if (!body || !body.dogId) {
      return NextResponse.json({ error: 'dogId mancante nel body.' }, { status: 400 });
    }

    const dogId: string = body.dogId;

    // Recuperiamo il cane
    const { data: dog, error } = await supabaseAdmin
      .from('dogs')
      .select('id, owner_id, public_id')
      .eq('id', dogId)
      .maybeSingle();

    if (error || !dog) {
      return NextResponse.json({ error: 'Cane non trovato.' }, { status: 404 });
    }

    // ✅ Ownership check (evita che un utente generi public_id per cani altrui)
    if (dog.owner_id !== userId) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 403 });
    }

    // Se esiste già un public_id, lo restituiamo
    if (dog.public_id) {
      return NextResponse.json({ publicId: dog.public_id });
    }

    const newPublicId = await generateUniquePublicId(dogId);

    return NextResponse.json({ publicId: newPublicId });
  } catch (err) {
    console.error('Errore in /api/dog-public-id:', err);

    if (err instanceof RouteAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore interno.' },
      { status: 500 }
    );
  }
}
