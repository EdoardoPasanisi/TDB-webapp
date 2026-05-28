import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthRedirectBase } from '@/lib/auth/getAuthRedirectBase';
import {
  getNotificationPreferencesForUser,
  isEmailNotificationEnabled,
  isInAppNotificationEnabled,
  mapNotificationTypeToCategory,
} from '@/lib/notifications/preferences';
import type { NotificationData, NotificationRow, NotificationType } from '@/types/notifications';

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() ?? '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() ?? '';
const RESEND_REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL?.trim() ?? '';

function castNotification(row: unknown): NotificationRow {
  const item = row as NotificationRow;
  return {
    ...item,
    data_json:
      item.data_json && typeof item.data_json === 'object' && !Array.isArray(item.data_json)
        ? item.data_json
        : {},
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildNotificationUrl(data?: NotificationData): string | null {
  const href = String(data?.href ?? '').trim();
  if (!href) return null;

  const base = getAuthRedirectBase();
  if (!base) return href.startsWith('http://') || href.startsWith('https://') ? href : null;

  try {
    return new URL(href, `${base}/`).toString();
  } catch {
    return null;
  }
}

function buildEmailPayload(args: {
  toEmail: string;
  title: string;
  body: string;
  data?: NotificationData;
}) {
  const notificationUrl = buildNotificationUrl(args.data);
  const escapedTitle = escapeHtml(args.title.trim());
  const escapedBody = escapeHtml(args.body.trim());
  const ctaHtml = notificationUrl
    ? `<p style="margin:20px 0 0;"><a href="${notificationUrl}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#ff8200;color:#111111;text-decoration:none;font-weight:700;">Apri nell'app</a></p>`
    : '';

  const html = [
    '<div style="font-family:Arial,sans-serif;background:#0b0f0d;color:#f3f4f6;padding:24px;">',
    '<div style="max-width:560px;margin:0 auto;background:#141817;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">',
    `<p style="margin:0 0 8px;color:#ffb061;font-size:13px;font-weight:700;letter-spacing:0.02em;">TENUTA DEL BARONE</p>`,
    `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#f3f4f6;">${escapedTitle}</h1>`,
    `<p style="margin:0;font-size:16px;line-height:1.55;color:#d1d5db;">${escapedBody}</p>`,
    ctaHtml,
    '<p style="margin:20px 0 0;font-size:12px;line-height:1.45;color:#9ca3af;">Ricevi questa email solo per aggiornamenti reali sul tuo account, mai per marketing.</p>',
    '</div>',
    '</div>',
  ].join('');

  const text = [
    args.title.trim(),
    '',
    args.body.trim(),
    notificationUrl ? '' : null,
    notificationUrl ? `Apri nell'app: ${notificationUrl}` : null,
    '',
    'Ricevi questa email solo per aggiornamenti reali sul tuo account, mai per marketing.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    from: RESEND_FROM_EMAIL,
    to: [args.toEmail],
    subject: args.title.trim(),
    html,
    text,
    reply_to: RESEND_REPLY_TO_EMAIL || undefined,
  };
}

async function resolveNotificationRecipientEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { email?: string | null } | null)?.email?.trim() || null;
}

async function sendNotificationEmail(args: {
  userId: string;
  title: string;
  body: string;
  data?: NotificationData;
}): Promise<void> {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return;

  const toEmail = await resolveNotificationRecipientEmail(args.userId);
  if (!toEmail) return;

  const payload = buildEmailPayload({
    toEmail,
    title: args.title,
    body: args.body,
    data: args.data,
  });

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(raw || `Email notification failed (${response.status}).`);
  }
}

export async function createNotification(args: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}): Promise<NotificationRow> {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: args.userId,
      type: args.type,
      title: args.title.trim(),
      body: args.body.trim(),
      data_json: args.data ?? {},
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Impossibile creare la notifica.');
  }

  return castNotification(data);
}

export async function createUserNotificationIfEnabled(args: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}): Promise<NotificationRow | null> {
  const preferences = await getNotificationPreferencesForUser(args.userId);
  const category = mapNotificationTypeToCategory(args.type);
  let createdNotification: NotificationRow | null = null;

  if (isInAppNotificationEnabled(preferences, category)) {
    createdNotification = await createNotification(args);
  }

  if (isEmailNotificationEnabled(preferences, category)) {
    try {
      await sendNotificationEmail(args);
    } catch (error) {
      console.error('Notification email delivery failed:', error);
    }
  }

  return createdNotification;
}

export async function listNotificationsForUser(args: {
  userId: string;
  limit?: number;
}): Promise<NotificationRow[]> {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .limit(args.limit ?? 20);

  if (error) throw new Error(error.message);
  return (data ?? []).map(castNotification);
}

export async function countUnreadNotificationsForUser(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationReadForUser(args: {
  notificationId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', args.notificationId)
    .eq('user_id', args.userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsReadForUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
}
