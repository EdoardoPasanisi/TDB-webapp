import { NextResponse } from 'next/server';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { RouteAuthError, requireRequestUser, routeAuthErrorResponse } from '@/lib/server/routeAuth';
import {
  createOperatorHandoff,
  ensureUserConversation,
  getUserThread,
  insertChatMessage,
  listConversationMessages,
  seedConversationTitleFromMessage,
  startNewUserConversation,
} from '@/lib/chat/db';
import { generateAssistantReply, AnthropicChatError } from '@/lib/chat/anthropic';
import { trimChatMessage } from '@/lib/chat/format';
import { checkRateLimit } from '@/lib/server/security';
import { CHAT_HISTORY_LIMIT, CHAT_MODEL } from '@/lib/chat/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readErrorMessage(error: unknown, fallback: string) {
  return humanizeErrorMessage(error, fallback);
}

function classifyChatInfraError(error: unknown): {
  shouldHandoff: boolean;
  userMessage: string;
} {
  const raw = String(error instanceof Error ? error.message : error ?? '').toLowerCase();
  const isQuota =
    error instanceof AnthropicChatError &&
    (error.code === 'rate_limit_error' || error.status === 429 || raw.includes('rate_limit') || raw.includes('quota'));
  const isConfig =
    raw.includes('anthropic_api_key non configurata') ||
    raw.includes('authentication_error') ||
    raw.includes('invalid x-api-key') ||
    raw.includes('invalid api key');

  if (isQuota) {
    return {
      shouldHandoff: false,
      userMessage:
        'La chat AI non è disponibile in questo momento per limiti di utilizzo. Riprova tra poco.',
    };
  }

  if (isConfig) {
    return {
      shouldHandoff: false,
      userMessage:
        'La chat AI non è configurata correttamente in questo ambiente. Serve completare la configurazione.',
    };
  }

  return {
    shouldHandoff: true,
    userMessage:
      'C’è stato un problema tecnico. Ho inoltrato la conversazione a un operatore: resterai nella stessa chat.',
  };
}

function readBodyString(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return '';
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const thread = await getUserThread(userId);
    return NextResponse.json(thread);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per usare la chat.'),
      });
    }

    return NextResponse.json(
      { error: readErrorMessage(error, 'Non siamo riusciti a caricare la chat.') },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const rateLimitError = checkRateLimit({
      request,
      identifier: userId,
      namespace: 'chat-message',
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      const response = NextResponse.json({ error: rateLimitError.message }, { status: rateLimitError.status });
      if (rateLimitError.retryAfterMs != null) {
        response.headers.set('Retry-After', String(Math.ceil(rateLimitError.retryAfterMs / 1000)));
      }
      return response;
    }

    const body = await request.json().catch(() => null);
    const message = trimChatMessage(readBodyString(body, 'message'));

    if (!message) {
      return NextResponse.json({ error: 'Messaggio vuoto.' }, { status: 400 });
    }

    let conversation = await ensureUserConversation(userId);
    await insertChatMessage({
      conversationId: conversation.id,
      senderType: 'USER',
      body: message,
    });

    conversation = await seedConversationTitleFromMessage({
      conversation,
      firstUserMessage: message,
    });

    if (conversation.status !== 'BOT_ACTIVE') {
      const thread = await getUserThread(userId);
      return NextResponse.json(thread);
    }

    try {
      const messages = await listConversationMessages(conversation.id, CHAT_HISTORY_LIMIT);
      const assistant = await generateAssistantReply({
        conversation,
        userId,
        messages,
      });

      await insertChatMessage({
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        body: assistant.text,
        metadata: {
          source: 'anthropic',
          model: CHAT_MODEL,
        },
      });
    } catch (error) {
      const fallback = classifyChatInfraError(error);

      if (fallback.shouldHandoff) {
        await createOperatorHandoff({
          conversationId: conversation.id,
          reason: 'SYSTEM_ERROR',
          summary: 'Fallback automatico per errore tecnico del chatbot.',
        });
      }

      await insertChatMessage({
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        body: fallback.userMessage,
        metadata: {
          source: fallback.shouldHandoff ? 'fallback_handoff' : 'fallback_setup_error',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    const thread = await getUserThread(userId);
    return NextResponse.json(thread);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per usare la chat.'),
      });
    }

    return NextResponse.json(
      { error: readErrorMessage(error, 'Non siamo riusciti a inviare il messaggio.') },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireRequestUser(request);
    const body = await request.json().catch(() => null);
    const action = readBodyString(body, 'action').trim();

    if (action !== 'new') {
      return NextResponse.json({ error: 'Azione chat non valida.' }, { status: 400 });
    }

    const thread = await startNewUserConversation(userId);
    return NextResponse.json(thread);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeAuthErrorResponse(error, {
        error: humanizeErrorMessage(error.message, 'Devi accedere per usare la chat.'),
      });
    }

    return NextResponse.json(
      { error: readErrorMessage(error, 'Non siamo riusciti a iniziare una nuova chat.') },
      { status: 500 }
    );
  }
}
