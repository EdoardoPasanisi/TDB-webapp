import { supabaseAdmin } from '@/lib/supabaseAdmin';

const IDENTITY_BUCKET = 'identity-documents';
const DOG_IMAGES_BUCKET = 'dog-images';

/**
 * Hard-delete completo di un account e di tutti i dati personali collegati:
 * file storage (documenti identità, foto cani), righe DB e infine l'utente
 * `auth.users`. Fonte unica usata sia dal flusso cliente (eliminazione account
 * in-app, requisito App Store 5.1.1-v) sia dal gestionale (`hardDeleteAdminUser`).
 *
 * I builder PostgREST non lanciano: l'eventuale error resta nel result e lo
 * ignoriamo per le tabelle accessorie (potrebbero non esistere su tutti gli
 * ambienti). L'unico errore fatale è quello di `auth.admin.deleteUser`.
 */
export async function purgeUserAccount(userId: string): Promise<void> {
  // Documenti identità: rimuovi i file dallo storage.
  const { data: documents } = await supabaseAdmin
    .from('user_documents')
    .select('path')
    .eq('user_id', userId);
  const docPaths = ((documents ?? []) as Array<{ path: string | null }>)
    .map((row) => String(row.path ?? '').trim())
    .filter(Boolean);
  if (docPaths.length > 0) {
    await supabaseAdmin.storage.from(IDENTITY_BUCKET).remove(docPaths).catch(() => undefined);
  }

  // Foto dei cani: rimuovi i file dallo storage.
  const { data: dogs } = await supabaseAdmin
    .from('dogs')
    .select('photo_path')
    .eq('owner_id', userId);
  const dogPhotoPaths = ((dogs ?? []) as Array<{ photo_path: string | null }>)
    .map((row) => String(row.photo_path ?? '').trim())
    .filter(Boolean);
  if (dogPhotoPaths.length > 0) {
    await supabaseAdmin.storage.from(DOG_IMAGES_BUCKET).remove(dogPhotoPaths).catch(() => undefined);
  }

  // Elimina i dati collegati. bookings → cascata su booking_dogs/customer_media.
  await supabaseAdmin.from('bookings').delete().eq('user_id', userId);
  await supabaseAdmin.from('service_slot_bookings').delete().eq('user_id', userId);
  await supabaseAdmin.from('service_passes').delete().eq('user_id', userId);
  await supabaseAdmin.from('user_documents').delete().eq('user_id', userId);
  await supabaseAdmin.from('customer_media').delete().eq('user_id', userId);
  await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
  await supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId);
  await supabaseAdmin.from('chat_conversations').delete().eq('user_id', userId);
  await supabaseAdmin.from('payments').delete().eq('user_id', userId);
  await supabaseAdmin.from('staff_accounts').delete().eq('user_id', userId);
  await supabaseAdmin.from('dogs').delete().eq('owner_id', userId);
  await supabaseAdmin.from('profiles').delete().eq('user_id', userId);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
