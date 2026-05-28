import {
  CHAT_TOOL_LOOP_LIMIT,
  OPENAI_CHAT_MODEL,
} from '@/lib/chat/config';
import { buildChatInstructions, buildOpenAIConversationInput } from '@/lib/chat/prompt';
import { loadChatKnowledgeBase } from '@/lib/chat/knowledgeBase';
import { executeChatTool, getChatToolDefinitions } from '@/lib/chat/tools';
import type { ChatConversationRow, ChatMessageRow } from '@/types/chat';

export class OpenAIChatError extends Error {
  status: number | null;
  code: string | null;

  constructor(message: string, args?: { status?: number | null; code?: string | null }) {
    super(message);
    this.name = 'OpenAIChatError';
    this.status = args?.status ?? null;
    this.code = args?.code ?? null;
  }
}

type OpenAIOutputItem = {
  type: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  content?: Array<{ type?: string; text?: string }>;
  text?: string;
};

type OpenAIResponsesResult = {
  output?: OpenAIOutputItem[];
  output_text?: string;
};

function ensureOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configurata.');
  }
  return apiKey;
}

function extractOutputText(response: OpenAIResponsesResult): string {
  const directText = String(response.output_text ?? '').trim();
  if (directText) return directText;

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (typeof item.text === 'string' && item.text.trim()) {
      chunks.push(item.text.trim());
    }

    for (const content of item.content ?? []) {
      if (typeof content.text === 'string' && content.text.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }

  return chunks.join('\n').trim();
}

async function createOpenAIResponse(body: Record<string, unknown>): Promise<OpenAIResponsesResult> {
  const apiKey = ensureOpenAIKey();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    try {
      const parsed = JSON.parse(errorText) as {
        error?: { message?: string; code?: string | null };
      };
      const message = String(parsed?.error?.message ?? '').trim() || 'Richiesta OpenAI non riuscita.';
      const code =
        parsed?.error && typeof parsed.error.code === 'string' ? parsed.error.code : null;
      throw new OpenAIChatError(message, {
        status: response.status,
        code,
      });
    } catch (error) {
      if (error instanceof OpenAIChatError) throw error;
      throw new OpenAIChatError(errorText || 'Richiesta OpenAI non riuscita.', {
        status: response.status,
        code: null,
      });
    }
  }

  return (await response.json()) as OpenAIResponsesResult;
}

export async function generateAssistantReply(args: {
  conversation: ChatConversationRow;
  userId: string;
  messages: ChatMessageRow[];
}): Promise<{ text: string; conversationChanged: boolean }> {
  const knowledgeBase = await loadChatKnowledgeBase();
  const instructions = buildChatInstructions(
    knowledgeBase,
    new Date().toISOString().slice(0, 10)
  );
  const inputItems = buildOpenAIConversationInput({
    conversation: args.conversation,
    messages: args.messages,
  });

  let conversationChanged = false;

  for (let round = 0; round < CHAT_TOOL_LOOP_LIMIT; round += 1) {
    const response = await createOpenAIResponse({
      model: OPENAI_CHAT_MODEL,
      instructions,
      input: inputItems,
      tools: getChatToolDefinitions(),
    });

    const outputItems = response.output ?? [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      const text = extractOutputText(response);
      if (!text) {
        throw new Error('OpenAI non ha restituito una risposta testuale.');
      }
      return { text, conversationChanged };
    }

    inputItems.push(...outputItems);

    for (const call of functionCalls) {
      const result = await executeChatTool({
        conversation: args.conversation,
        userId: args.userId,
        name: call.name ?? '',
        rawArguments: call.arguments ?? '{}',
      });

      if (call.name === 'create_operator_handoff') {
        conversationChanged = true;
      }

      inputItems.push({
        type: 'function_call_output',
        call_id: String(call.call_id ?? ''),
        output: JSON.stringify(result),
      });
    }
  }

  throw new Error('Limite tool-calling raggiunto senza risposta finale.');
}
