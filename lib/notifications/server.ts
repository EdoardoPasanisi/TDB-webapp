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
    ? `<tr><td style="padding:24px 40px 0;">` +
      `<a href="${notificationUrl}" style="display:inline-block;padding:12px 24px;background:#2f4f3f;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:700;border-radius:8px;">` +
      `Apri nell&rsquo;app &rarr;</a></td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapedTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;">
  <div style="display:none;max-height:0;overflow:hidden;color:#f5f0e8;">${escapedBody.slice(0, 90)}&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0e8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 16px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#2f4f3f;text-transform:uppercase;">Tenuta del Barone</p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;border:1px solid #e5ddd0;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Accent bar -->
                <tr>
                  <td style="background:#2f4f3f;border-radius:12px 12px 0 0;height:4px;font-size:0;">&nbsp;</td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 40px 8px;">
                    <h1 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:#1a1a1a;">${escapedTitle}</h1>
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#444444;">${escapedBody}</p>
                  </td>
                </tr>

                <!-- CTA -->
                ${ctaHtml}

                <!-- Divider -->
                <tr>
                  <td style="padding:28px 40px 0;">
                    <hr style="border:none;border-top:1px solid #e5ddd0;margin:0;" />
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:16px 40px 28px;">
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#888888;">
                      Ricevi questa email perché hai un account su app.tenutadelbarone.com.<br />
                      Non utilizziamo la tua email per marketing o comunicazioni promozionali.<br /><br />
                      <strong>Tenuta del Barone srls</strong> &mdash; Via Davide Passigli 60, 00054 Fiumicino RM<br />
                      P.IVA 16378301002 &mdash; <a href="mailto:info@tenutadelbarone.com" style="color:#2f4f3f;text-decoration:none;">info@tenutadelbarone.com</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    args.title.trim(),
    '',
    args.body.trim(),
    notificationUrl ? '' : null,
    notificationUrl ? `Apri nell'app: ${notificationUrl}` : null,
    '',
    '---',
    'Tenuta del Barone srls — Via Davide Passigli 60, 00054 Fiumicino RM',
    'P.IVA 16378301002 — info@tenutadelbarone.com',
    'Ricevi questa email perché hai un account su app.tenutadelbarone.com.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    from: RESEND_FROM_EMAIL,
    to: [args.toEmail],
    subject: `${args.title.trim()} — Tenuta del Barone`,
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

    // Push APNs verso i device iOS dell'utente (fire-and-forget: un errore non
    // deve compromettere la notifica in-app). Import dinamico così node:http2/
    // node:crypto restano fuori dai bundle che non ne hanno bisogno.
    try {
      const { sendApnsToUser } = await import('@/lib/notifications/apns');
      await sendApnsToUser({
        userId: args.userId,
        title: args.title,
        body: args.body,
        data: args.data,
      });
    } catch (error) {
      console.error('Notification push delivery failed:', error);
    }
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

// Le notifiche lette restano visibili per questo intervallo, poi spariscono.
// Le notifiche non lette non scadono mai.
const READ_NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 ore lato utente

export async function listNotificationsForUser(args: {
  userId: string;
  limit?: number;
}): Promise<NotificationRow[]> {
  const readCutoff = new Date(Date.now() - READ_NOTIFICATION_RETENTION_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', args.userId)
    .or(`read_at.is.null,read_at.gte.${readCutoff}`)
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
