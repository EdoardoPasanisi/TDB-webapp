import { NextResponse } from 'next/server';
import { requireStaffAccess } from '@/lib/admin/auth';
import { createUserNotificationIfEnabled } from '@/lib/notifications/server';
import { adminErrorResponse } from '@/lib/admin/route';
import {
  canStaffMutateConversation,
  claimConversationByAdmin,
  getAdminConversationDetail,
  getConversationById,
  insertChatMessage,
  reopenConversation,
} from '@/lib/chat/db';
import { trimChatMessage } from '@/lib/chat/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readBodyString(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return '';
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireStaffAccess('view');
    const { conversationId } = await context.params;
    const body = await request.json().catch(() => null);
    const message = trimChatMessage(readBodyString(body, 'message'));

    if (!message) {
      return NextResponse.json({ error: 'Messaggio vuoto.' }, { status: 400 });
    }

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversazione non trovata.' }, { status: 404 });
    }

    if (!canStaffMutateConversation({ conversation, access, action: 'reply' })) {
      return NextResponse.json({ error: 'Non puoi rispondere in questa conversazione.' }, { status: 403 });
    }

    if (conversation.status === 'CLOSED') {
      await reopenConversation({
        conversationId,
        adminUserId: access.userId,
      });
    } else if (conversation.status !== 'ADMIN_ACTIVE' || conversation.assigned_admin_user_id !== access.userId) {
      await claimConversationByAdmin({
        conversationId,
        adminUserId: access.userId,
      });
    }

    await insertChatMessage({
      conversationId,
      senderType: 'ADMIN',
      adminUserId: access.userId,
      body: message,
      metadata: {
        source: 'admin_console',
      },
    });

    await createUserNotificationIfEnabled({
      userId: conversation.user_id,
      type: 'CHAT_OPERATOR_REPLY',
      title: 'Nuova risposta in chat',
      body: message.length > 120 ? `${message.slice(0, 117)}...` : message,
      data: {
        href: '/chat',
        conversationId,
      },
    });

    const detail = await getAdminConversationDetail(conversationId);
    if (!detail) {
      return NextResponse.json({ error: 'Conversazione non trovata.' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
