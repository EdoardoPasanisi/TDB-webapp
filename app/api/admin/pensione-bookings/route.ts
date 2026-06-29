import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { adminErrorResponse } from '@/lib/admin/route';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sanitizeAdminPensioneBookingUserId, assertUuid } from '@/lib/admin/validation';
import { parsePensioneBookingInput } from '@/lib/services/pensione/parseInput';
import { createPensioneBooking, PensioneBookingError } from '@/lib/services/pensione/persist';
import { createManageStaffNotifications } from '@/lib/admin/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cani prenotabili in pensione per un dato utente (usato dal form gestionale).
export async function GET(request: Request) {
  try {
    await requireStaffAccess('view');

    const { searchParams } = new URL(request.url);
    const userId = assertUuid(searchParams.get('userId'), 'Utente');

    const { data, error } = await supabaseAdmin
      .from('dogs')
      .select('id, name, photo_path, updated_at, size_category, grooming_difficulty, species, microchip, birth_date, libretto_name')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(error.message ?? 'Impossibile caricare i cani dell’utente.');
    }

    // In pensione si prenotano solo cani e gatti ("altro" non è prenotabile).
    const dogs = ((data ?? []) as Array<{ species: string | null }>).filter(
      (dog) => (dog.species ?? 'DOG') !== 'OTHER'
    );

    return NextResponse.json({ dogs });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAccess(request, 'manage');

    const rawBody = await request.json().catch(() => null);
    const userId = sanitizeAdminPensioneBookingUserId(rawBody);
    const input = parsePensioneBookingInput(rawBody);

    if (!input) {
      return NextResponse.json({ error: 'Payload prenotazione non valido.' }, { status: 400 });
    }

    // Lo staff crea la prenotazione già CONFERMATA e bypassa i blocchi pensione.
    const { bookingId, ownerName, dogsLabel } = await createPensioneBooking({
      userId,
      input,
      status: 'CONFIRMED',
      enforcePetRequirements: false,
    });

    try {
      await createManageStaffNotifications({
        type: 'BOOKING_ACTION_REQUIRED',
        title: 'Prenotazione pensione creata',
        body: `Prenotazione pensione creata dallo staff per ${ownerName} (${dogsLabel}).`,
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
    if (error instanceof PensioneBookingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return adminErrorResponse(error);
  }
}
