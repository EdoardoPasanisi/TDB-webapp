import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { RouteAuthError, requireRequestUser } from '@/lib/server/routeAuth';
import {
  createOperatorHandoff,
  ensureUserConversation,
  getUserThread,
  insertChatMessage,
} from '@/lib/chat/db';
import { trimChatMessage } from '@/lib/chat/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readBodyString(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return '';
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const body = await request.json().catch(() => null);
    const message = trimChatMessage(readBodyString(body, 'message'));
    const summary = trimChatMessage(readBodyString(body, 'summary'));

    const conversation = await ensureUserConversation(userId);
    if (message) {
      await insertChatMessage({
        conversationId: conversation.id,
        senderType: 'USER',
        body: message,
      });
    }

    if (conversation.status === 'BOT_ACTIVE') {
      await createOperatorHandoff({
        conversationId: conversation.id,
        reason: 'USER_REQUEST',
        summary: summary || 'Il cliente ha richiesto un operatore.',
      });

      await insertChatMessage({
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        body:
          'Va bene, affido subito la chat a un operatore. Potrai uscire e tornare qui: la conversazione restera disponibile finche l’operatore non la chiudera.',
        metadata: {
          source: 'manual_handoff',
        },
      });
    }

    const thread = await getUserThread(userId);
    return NextResponse.json(thread);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json(
        { error: humanizeErrorMessage(error.message, 'Devi accedere per usare la chat.') },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: humanizeErrorMessage(
          error,
          'Non siamo riusciti a richiedere l’intervento di un operatore.'
        ),
      },
      { status: 500 }
    );
  }
}
