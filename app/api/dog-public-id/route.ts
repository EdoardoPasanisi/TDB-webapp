/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // ✅ Richiede sessione valida (passata dal client come Bearer token)
    const authHeader = req.headers.get('authorization') ?? '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1] ?? null;
    if (!accessToken) {
      return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Sessione non valida.' }, { status: 401 });
    }

    const userId = userData.user.id;

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

    // Generiamo un nuovo public_id (stringa breve, tipo 10 caratteri)
    const newPublicId = randomBytes(6).toString('hex'); // 12 caratteri esadecimali

    const { error: updateError } = await supabaseAdmin
      .from('dogs')
      .update({ public_id: newPublicId })
      .eq('id', dogId);

    if (updateError) {
      return NextResponse.json({ error: 'Errore nel salvataggio del public_id.' }, { status: 500 });
    }

    return NextResponse.json({ publicId: newPublicId });
  } catch (err: any) {
    console.error('Errore in /api/dog-public-id:', err);
    return NextResponse.json({ error: 'Errore interno.' }, { status: 500 });
  }
}
