import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/server/supabaseServer';
import type { AdminStaffAccess, StaffRole } from '@/lib/admin/types';

type StaffAccountRow = {
  user_id: string;
  role: StaffRole;
  is_active: boolean;
};

export class AdminAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getStaffAccess(): Promise<AdminStaffAccess | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new AdminAccessError(401, userError.message);
  }

  if (!user) return null;

  const { data, error } = await supabase
    .from('staff_accounts')
    .select('user_id, role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new AdminAccessError(403, 'Accesso gestionale non configurato.');
  }

  const row = (data as StaffAccountRow | null) ?? null;

  if (!row || !row.is_active) return null;

  return {
    userId: row.user_id,
    email: user.email ?? null,
    role: row.role,
    canManage: row.role === 'ADMIN',
  };
}

export async function requireStaffAccess(mode: 'view' | 'manage' = 'view'): Promise<AdminStaffAccess> {
  const access = await getStaffAccess();

  if (!access) {
    throw new AdminAccessError(403, 'Non hai accesso al gestionale.');
  }

  if (mode === 'manage' && !access.canManage) {
    throw new AdminAccessError(403, 'Il tuo account ha accesso in sola lettura.');
  }

  return access;
}

export async function getStaffRoleForUser(userId: string): Promise<StaffRole | null> {
  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .select('role, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  if (!data || data.is_active === false) return null;

  return (data.role as StaffRole) ?? null;
}
