export type ChatConversationStatus =
  | 'BOT_ACTIVE'
  | 'HANDOFF_REQUESTED'
  | 'ADMIN_ACTIVE'
  | 'CLOSED';

export type ChatSenderType = 'USER' | 'ASSISTANT' | 'ADMIN' | 'SYSTEM';

export type ChatHandoffReason =
  | 'USER_REQUEST'
  | 'MODEL_UNCERTAIN'
  | 'SENSITIVE_TOPIC'
  | 'SYSTEM_ERROR';

export type ChatConversationRow = {
  id: string;
  user_id: string;
  status: ChatConversationStatus;
  title: string | null;
  handoff_reason: ChatHandoffReason | null;
  handoff_summary: string | null;
  assigned_admin_user_id: string | null;
  handoff_requested_at: string | null;
  admin_claimed_at: string | null;
  closed_at: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_type: ChatSenderType;
  admin_user_id: string | null;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatUserThreadResponse = {
  conversation: ChatConversationRow;
  messages: ChatMessageRow[];
};

export type ChatAdminConversationListItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userPhone: string | null;
  status: ChatConversationStatus;
  handoffReason: ChatHandoffReason | null;
  handoffSummary: string | null;
  assignedAdminUserId: string | null;
  assignedAdminLabel: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  createdAt: string;
};

export type ChatAdminConversationDetail = {
  conversation: ChatConversationRow;
  messages: ChatMessageRow[];
  user: {
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    dogNames: string[];
  };
};
