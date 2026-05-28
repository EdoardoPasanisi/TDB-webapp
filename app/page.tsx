import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/server/supabaseServer';

export const dynamic = 'force-dynamic';

async function resolveHomeRedirect(): Promise<string> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return '/login';

    const { data: staffAccess, error: staffError } = await supabase
      .from('staff_accounts')
      .select('is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!staffError && staffAccess?.is_active) {
      return '/admin';
    }

    return '/services';
  } catch {
    return '/login';
  }
}

export default async function HomePage() {
  redirect(await resolveHomeRedirect());
}
