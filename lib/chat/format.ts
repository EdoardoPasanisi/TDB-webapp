import type {
  ChatConversationStatus,
  ChatHandoffReason,
  ChatSenderType,
} from '@/types/chat';

export function getChatStatusLabel(status: ChatConversationStatus): string {
  if (status === 'BOT_ACTIVE') return 'Assistente';
  if (status === 'HANDOFF_REQUESTED') return 'Richiesta operatore';
  if (status === 'ADMIN_ACTIVE') return 'Operatore';
  if (status === 'CLOSED') return 'Chiusa';
  return status;
}

export function getChatSenderLabel(senderType: ChatSenderType): string {
  if (senderType === 'USER') return 'Cliente';
  if (senderType === 'ADMIN') return 'Operatore';
  if (senderType === 'SYSTEM') return 'Sistema';
  return 'Assistente';
}

export function getChatHandoffReasonLabel(reason: ChatHandoffReason | null): string {
  if (reason === 'USER_REQUEST') return 'Richiesta cliente';
  if (reason === 'MODEL_UNCERTAIN') return 'Domanda non coperta';
  if (reason === 'SENSITIVE_TOPIC') return 'Tema delicato';
  if (reason === 'SYSTEM_ERROR') return 'Problema tecnico';
  return 'Non specificato';
}

/**
 * La chat mostra il testo come plain text (vedi UserChatPage / ChatTab): senza
 * questo, eventuale Markdown del modello (es. **grassetto**) comparirebbe con gli
 * asterischi visibili. Rimuoviamo i marcatori di enfasi/titoli mantenendo il testo.
 */
export function stripChatMarkdownEmphasis(value: string): string {
  let out = String(value ?? '');
  out = out.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '$1'); // ***bold italic***
  out = out.replace(/\*\*([\s\S]+?)\*\*/g, '$1'); // **bold**
  out = out.replace(/___([\s\S]+?)___/g, '$1');
  out = out.replace(/__([\s\S]+?)__/g, '$1'); // __bold__
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, ''); // # titoli a inizio riga
  out = out.replace(/\*\*/g, ''); // marcatori residui
  return out;
}

export function trimChatMessage(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function buildConversationTitle(firstMessage: string): string | null {
  const normalized = trimChatMessage(firstMessage);
  if (!normalized) return null;
  return normalized.slice(0, 80);
}

export function buildMessagePreview(body: string): string | null {
  const normalized = trimChatMessage(body);
  return normalized ? normalized.slice(0, 140) : null;
}
