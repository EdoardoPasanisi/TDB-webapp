import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { NotificationType } from '@/types/notifications';
import type {
  NotificationPreferenceCategory,
  NotificationPreferences,
} from '@/types/notificationPreferences';

const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'> = {
  booking_in_app: true,
  booking_email: false,
  document_in_app: true,
  document_email: false,
  chat_in_app: true,
  chat_email: false,
  media_in_app: true,
  media_email: false,
};

function buildDefaultNotificationPreferences(userId: string): NotificationPreferences {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    created_at: now,
    updated_at: now,
  };
}

export function mapNotificationTypeToCategory(type: NotificationType): NotificationPreferenceCategory {
  if (type === 'BOOKING_STATUS') return 'booking';
  if (type === 'DOCUMENT_STATUS') return 'document';
  if (type === 'CHAT_OPERATOR_REPLY') return 'chat';
  return 'media';
}

export function isInAppNotificationEnabled(
  preferences: NotificationPreferences,
  category: NotificationPreferenceCategory
): boolean {
  if (category === 'booking') return preferences.booking_in_app;
  if (category === 'document') return preferences.document_in_app;
  if (category === 'chat') return preferences.chat_in_app;
  return preferences.media_in_app;
}

export function isEmailNotificationEnabled(
  preferences: NotificationPreferences,
  category: NotificationPreferenceCategory
): boolean {
  if (category === 'booking') return preferences.booking_email;
  if (category === 'document') return preferences.document_email;
  if (category === 'chat') return preferences.chat_email;
  return preferences.media_email;
}

export async function getNotificationPreferencesForUser(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as NotificationPreferences | null) ?? buildDefaultNotificationPreferences(userId);
}

export async function upsertNotificationPreferencesForUser(args: {
  userId: string;
  patch: Partial<Omit<NotificationPreferences, 'user_id' | 'created_at' | 'updated_at'>>;
}): Promise<NotificationPreferences> {
  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .upsert(
      {
        user_id: args.userId,
        ...args.patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile salvare le preferenze notifiche.');
  }

  return data as NotificationPreferences;
}
