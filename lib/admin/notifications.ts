import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type {
  StaffNotificationData,
  StaffNotificationRow,
  StaffNotificationType,
} from '@/types/adminNotifications';

function castStaffNotification(row: unknown): StaffNotificationRow {
  const item = row as StaffNotificationRow;
  return {
    ...item,
    data_json:
      item.data_json && typeof item.data_json === 'object' && !Array.isArray(item.data_json)
        ? item.data_json
        : {},
  };
}

async function listActiveManageStaffUserIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('staff_accounts')
    .select('user_id')
    .eq('is_active', true)
    .eq('role', 'ADMIN');

  if (error) {
    throw new Error(error.message);
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String((row as { user_id?: unknown }).user_id ?? '').trim())
        .filter(Boolean)
    )
  );
}

export async function createManageStaffNotifications(args: {
  type: StaffNotificationType;
  title: string;
  body: string;
  data?: StaffNotificationData;
}): Promise<void> {
  const userIds = await listActiveManageStaffUserIds();
  if (userIds.length === 0) return;

  const payload = userIds.map((userId) => ({
    user_id: userId,
    type: args.type,
    title: args.title.trim(),
    body: args.body.trim(),
    data_json: args.data ?? {},
  }));

  const { error } = await supabaseAdmin.from('staff_notifications').insert(payload);
  if (error) throw new Error(error.message);
}

export async function listStaffNotificationsForUser(args: {
  userId: string;
  limit?: number;
}): Promise<StaffNotificationRow[]> {
  const { data, error } = await supabaseAdmin
    .from('staff_notifications')
    .select('*')
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 20);

  if (error) throw new Error(error.message);
  return (data ?? []).map(castStaffNotification);
}

export async function countUnreadStaffNotificationsForUser(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('staff_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markStaffNotificationReadForUser(args: {
  notificationId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('staff_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', args.notificationId)
    .eq('user_id', args.userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
}

export async function markAllStaffNotificationsReadForUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('staff_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
}
