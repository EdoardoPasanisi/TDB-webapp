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
