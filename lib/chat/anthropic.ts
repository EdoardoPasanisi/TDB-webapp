import { CHAT_MAX_TOKENS, CHAT_MODEL, CHAT_TOOL_LOOP_LIMIT } from '@/lib/chat/config';
import { buildChatInstructions, buildAnthropicMessages, type AnthropicChatMessage } from '@/lib/chat/prompt';
import { loadChatKnowledgeBase } from '@/lib/chat/knowledgeBase';
import { executeChatTool, getAnthropicChatTools } from '@/lib/chat/tools';
import type { ChatConversationRow, ChatMessageRow } from '@/types/chat';

export class AnthropicChatError extends Error {
  status: number | null;
  code: string | null;

  constructor(message: string, args?: { status?: number | null; code?: string | null }) {
    super(message);
    this.name = 'AnthropicChatError';
    this.status = args?.status ?? null;
    this.code = args?.code ?? null;
  }
}

// I tool che modificano dati: dopo l'esecuzione la chat/prenotazioni possono cambiare.
const CONVERSATION_CHANGING_TOOLS = new Set([
  'create_operator_handoff',
  'cancel_user_pensione_booking',
  'delete_user_pensione_booking',
  'cancel_user_slot_booking',
]);

type AnthropicContentBlock =
  | { type: 'text'; text?: string }
  | { type: 'tool_use'; id?: string; name?: string; input?: Record<string, unknown> }
  | { type: string; [key: string]: unknown };

type AnthropicMessage = {
  role: 'assistant' | 'user';
  content: AnthropicContentBlock[] | string;
};

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
};

function ensureAnthropicKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configurata.');
  }
  return apiKey;
}

function extractText(content: AnthropicContentBlock[]): string {
  const chunks: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && typeof (block as { text?: string }).text === 'string') {
      const text = String((block as { text?: string }).text ?? '').trim();
      if (text) chunks.push(text);
    }
  }
  return chunks.join('\n').trim();
}

async function createAnthropicResponse(body: Record<string, unknown>): Promise<AnthropicResponse> {
  const apiKey = ensureAnthropicKey();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let message = errorText || 'Richiesta Claude non riuscita.';
    let code: string | null = null;
    try {
      const parsed = JSON.parse(errorText) as { error?: { message?: string; type?: string | null } };
      message = String(parsed?.error?.message ?? '').trim() || message;
      code = typeof parsed?.error?.type === 'string' ? parsed.error.type : null;
    } catch {}
    throw new AnthropicChatError(message, { status: response.status, code });
  }

  return (await response.json()) as AnthropicResponse;
}

export async function generateAssistantReply(args: {
  conversation: ChatConversationRow;
  userId: string;
  messages: ChatMessageRow[];
}): Promise<{ text: string; conversationChanged: boolean }> {
  const knowledgeBase = await loadChatKnowledgeBase();
  const system = buildChatInstructions(knowledgeBase, new Date().toISOString().slice(0, 10));
  const tools = getAnthropicChatTools();

  const conversation: (AnthropicChatMessage | AnthropicMessage)[] = buildAnthropicMessages({
    messages: args.messages,
  });

  let conversationChanged = false;

  for (let round = 0; round < CHAT_TOOL_LOOP_LIMIT; round += 1) {
    const response = await createAnthropicResponse({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system,
      messages: conversation,
      tools,
      // Bot di supporto: niente extended thinking, effort basso = risposte rapide ed economiche.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
    });

    const content = response.content ?? [];
    const toolUses = content.filter(
      (block): block is { type: 'tool_use'; id?: string; name?: string; input?: Record<string, unknown> } =>
        block.type === 'tool_use'
    );

    if (toolUses.length === 0) {
      const text = extractText(content);
      if (!text) {
        throw new Error('Claude non ha restituito una risposta testuale.');
      }
      return { text, conversationChanged };
    }

    // Rimanda indietro i blocchi dell'assistente (incl. tool_use) e poi i risultati dei tool.
    conversation.push({ role: 'assistant', content });

    const toolResults: AnthropicContentBlock[] = [];
    for (const call of toolUses) {
      const result = await executeChatTool({
        conversation: args.conversation,
        userId: args.userId,
        name: call.name ?? '',
        rawArguments: JSON.stringify(call.input ?? {}),
      });

      if (call.name && CONVERSATION_CHANGING_TOOLS.has(call.name)) {
        conversationChanged = true;
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: String(call.id ?? ''),
        content: JSON.stringify(result),
      });
    }

    conversation.push({ role: 'user', content: toolResults });
  }

  throw new Error('Limite tool-calling raggiunto senza risposta finale.');
}
