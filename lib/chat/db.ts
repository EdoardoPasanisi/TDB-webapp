import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createManageStaffNotifications } from '@/lib/admin/notifications';
import { formatPersonName } from '@/lib/admin/utils';
import {
  buildConversationTitle,
  buildMessagePreview,
  trimChatMessage,
} from '@/lib/chat/format';
import {
  CHAT_BOT_IDLE_CLOSE_MINUTES,
  CHAT_BOT_IDLE_WARNING_MINUTES,
} from '@/lib/chat/config';
import type {
  ChatAdminConversationDetail,
  ChatAdminConversationListItem,
  ChatConversationRow,
  ChatConversationStatus,
  ChatHandoffReason,
  ChatMessageRow,
  ChatSenderType,
} from '@/types/chat';
import type { Profile } from '@/types/profile';
import type { Dog } from '@/types/dog';
import type { AdminStaffAccess } from '@/lib/admin/types';

type ConversationInsert = {
  user_id: string;
  status?: ChatConversationStatus;
  title?: string | null;
  handoff_reason?: ChatHandoffReason | null;
  handoff_summary?: string | null;
  assigned_admin_user_id?: string | null;
  handoff_requested_at?: string | null;
  admin_claimed_at?: string | null;
  closed_at?: string | null;
  last_message_at?: string;
  last_message_preview?: string | null;
};

type ConversationUpdate = Partial<ConversationInsert>;

type ProfileSummary = Pick<Profile, 'user_id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'city'>;
type DogSummary = Pick<Dog, 'owner_id' | 'name'>;

function castConversation(row: unknown): ChatConversationRow {
  return row as ChatConversationRow;
}

function castMessage(row: unknown): ChatMessageRow {
  const message = row as ChatMessageRow;
  return {
    ...message,
    metadata:
      message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
        ? message.metadata
        : {},
  };
}

function formatFullName(profile: ProfileSummary | null): string {
  const parts = [profile?.first_name, profile?.last_name]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  return parts.join(' ') || 'Cliente';
}

function readMessageSource(message: ChatMessageRow | null): string {
  if (!message?.metadata || typeof message.metadata !== 'object' || Array.isArray(message.metadata)) {
    return '';
  }
  const source = (message.metadata as Record<string, unknown>).source;
  return typeof source === 'string' ? source : '';
}

function getIdleMilliseconds(lastMessageAt: string): number {
  const timestamp = new Date(lastMessageAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Date.now() - timestamp);
}

function isPastBotCloseThreshold(conversation: ChatConversationRow): boolean {
  if (conversation.status !== 'BOT_ACTIVE') return false;
  return getIdleMilliseconds(conversation.last_message_at) >= CHAT_BOT_IDLE_CLOSE_MINUTES * 60 * 1000;
}

async function getLatestConversationMessage(conversationId: string): Promise<ChatMessageRow | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? castMessage(data) : null;
}

async function closeBotConversationAutomatically(conversationId: string): Promise<ChatConversationRow> {
  const nowIso = new Date().toISOString();
  return updateConversation(conversationId, {
    status: 'CLOSED',
    assigned_admin_user_id: null,
    closed_at: nowIso,
  });
}

async function insertLifecycleChatMessage(args: {
  conversationId: string;
  senderType: ChatSenderType;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessageRow> {
  const normalizedBody = trimChatMessage(args.body);
  if (!normalizedBody) {
    throw new Error('Messaggio vuoto.');
  }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      conversation_id: args.conversationId,
      sender_type: args.senderType,
      admin_user_id: null,
      body: normalizedBody,
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Impossibile salvare il messaggio di sistema.');
  return castMessage(data);
}

async function maybeCloseActiveBotConversationForWrite(
  conversation: ChatConversationRow
): Promise<ChatConversationRow> {
  if (!isPastBotCloseThreshold(conversation)) return conversation;

  const lastMessage = await getLatestConversationMessage(conversation.id);
  if (readMessageSource(lastMessage) !== 'bot_auto_close') {
    await insertLifecycleChatMessage({
      conversationId: conversation.id,
      senderType: 'ASSISTANT',
      body:
        'Chiudo automaticamente questa chat per inattivita. Se ti serve ancora aiuto, puoi aprirne una nuova quando vuoi.',
      metadata: {
        source: 'bot_auto_close',
      },
    });
  }

  return closeBotConversationAutomatically(conversation.id);
}

async function reconcileBotConversationForRead(
  conversation: ChatConversationRow
): Promise<ChatConversationRow> {
  if (conversation.status !== 'BOT_ACTIVE') return conversation;

  const idleMs = getIdleMilliseconds(conversation.last_message_at);
  const warningMs = CHAT_BOT_IDLE_WARNING_MINUTES * 60 * 1000;
  const closeMs = CHAT_BOT_IDLE_CLOSE_MINUTES * 60 * 1000;

  if (idleMs < warningMs) return conversation;

  const lastMessage = await getLatestConversationMessage(conversation.id);
  const lastSource = readMessageSource(lastMessage);

  if (idleMs >= closeMs) {
    if (lastSource !== 'bot_auto_close') {
      await insertLifecycleChatMessage({
        conversationId: conversation.id,
        senderType: 'ASSISTANT',
        body:
          'Chiudo automaticamente questa chat per inattivita. Se ti serve ancora aiuto, puoi aprirne una nuova quando vuoi.',
        metadata: {
          source: 'bot_auto_close',
        },
      });
    }

    return closeBotConversationAutomatically(conversation.id);
  }

  if (lastSource === 'bot_idle_warning' || lastSource === 'bot_auto_close') {
    return conversation;
  }

  await insertLifecycleChatMessage({
    conversationId: conversation.id,
    senderType: 'ASSISTANT',
    body:
      'Se non arrivano altri messaggi, tra poco chiudero automaticamente questa chat. Se ti serve ancora aiuto, scrivimi pure qui.',
    metadata: {
      source: 'bot_idle_warning',
    },
  });

  const updated = await getConversationById(conversation.id);
  return updated ?? conversation;
}

export function canStaffViewConversation(args: {
  conversation: ChatConversationRow;
  access: AdminStaffAccess;
}): boolean {
  const { conversation, access } = args;
  if (access.canManage) return true;
  if (conversation.status === 'HANDOFF_REQUESTED') return true;
  return (
    conversation.status === 'ADMIN_ACTIVE' &&
    conversation.assigned_admin_user_id === access.userId
  );
}

export function canStaffMutateConversation(args: {
  conversation: ChatConversationRow;
  access: AdminStaffAccess;
  action: 'claim' | 'close' | 'reopen' | 'reply';
}): boolean {
  const { conversation, access, action } = args;
  if (access.canManage) return true;

  if (action === 'claim') {
    return conversation.status === 'HANDOFF_REQUESTED';
  }

  if (action === 'reply') {
    return (
      conversation.status === 'HANDOFF_REQUESTED' ||
      (conversation.status === 'ADMIN_ACTIVE' &&
        conversation.assigned_admin_user_id === access.userId)
    );
  }

  if (action === 'close') {
    return (
      conversation.status === 'ADMIN_ACTIVE' &&
      conversation.assigned_admin_user_id === access.userId
    );
  }

  if (action === 'reopen') {
    return false;
  }

  return false;
}

async function getLatestConversationForUser(userId: string): Promise<ChatConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? castConversation(data) : null;
}

export async function getUserActiveConversation(userId: string): Promise<ChatConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'CLOSED')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? castConversation(data) : null;
}

export async function createConversation(args: {
  userId: string;
  initialTitle?: string | null;
}): Promise<ChatConversationRow> {
  const payload: ConversationInsert = {
    user_id: args.userId,
    title: args.initialTitle ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Impossibile creare la conversazione.');
  return castConversation(data);
}

export async function ensureUserConversation(userId: string): Promise<ChatConversationRow> {
  const existing = await getUserActiveConversation(userId);
  if (existing) {
    const normalized = await maybeCloseActiveBotConversationForWrite(existing);
    if (normalized.status !== 'CLOSED') return normalized;
  }
  return createConversation({ userId });
}

export async function getConversationForUser(args: {
  conversationId: string;
  userId: string;
}): Promise<ChatConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .eq('id', args.conversationId)
    .eq('user_id', args.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? castConversation(data) : null;
}

export async function getConversationById(conversationId: string): Promise<ChatConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? castConversation(data) : null;
}

export async function listConversationMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(castMessage);
}

export async function updateConversation(
  conversationId: string,
  patch: ConversationUpdate
): Promise<ChatConversationRow> {
  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .update(patch)
    .eq('id', conversationId)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Impossibile aggiornare la conversazione.');
  return castConversation(data);
}

export async function insertChatMessage(args: {
  conversationId: string;
  senderType: ChatSenderType;
  body: string;
  adminUserId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ChatMessageRow> {
  const normalizedBody = trimChatMessage(args.body);
  if (!normalizedBody) {
    throw new Error('Messaggio vuoto.');
  }

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      conversation_id: args.conversationId,
      sender_type: args.senderType,
      admin_user_id: args.adminUserId ?? null,
      body: normalizedBody,
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Impossibile salvare il messaggio.');

  await updateConversation(args.conversationId, {
    last_message_at: castMessage(data).created_at,
    last_message_preview: buildMessagePreview(normalizedBody),
  });

  return castMessage(data);
}

export async function createOperatorHandoff(args: {
  conversationId: string;
  reason: ChatHandoffReason;
  summary: string;
}): Promise<ChatConversationRow> {
  const nowIso = new Date().toISOString();
  const conversation = await updateConversation(args.conversationId, {
    status: 'HANDOFF_REQUESTED',
    handoff_reason: args.reason,
    handoff_summary: trimChatMessage(args.summary) || null,
    handoff_requested_at: nowIso,
    closed_at: null,
  });

  try {
    const { data } = await supabaseAdmin
      .from('chat_conversations')
      .select('user_id, profiles(first_name, last_name, email)')
      .eq('id', args.conversationId)
      .maybeSingle();

    const row = (data ?? null) as
      | {
          user_id: string;
          profiles?:
            | {
                first_name?: string | null;
                last_name?: string | null;
                email?: string | null;
              }
            | Array<{
                first_name?: string | null;
                last_name?: string | null;
                email?: string | null;
              }>;
        }
      | null;
    const profile = Array.isArray(row?.profiles) ? row?.profiles[0] ?? null : row?.profiles ?? null;
    const customerName = formatPersonName(
      profile?.first_name ?? null,
      profile?.last_name ?? null,
      profile?.email ?? null
    );

    await createManageStaffNotifications({
      type: 'CHAT_ACTION_REQUIRED',
      title: 'Nuova chat da prendere in carico',
      body: `${customerName} ha richiesto un operatore in chat.`,
      data: {
        href: '/admin?tab=chat',
        adminTab: 'chat',
        conversationId: args.conversationId,
      },
    });
  } catch (error) {
    console.error('Admin chat notification failed:', error);
  }

  return conversation;
}

export async function claimConversationByAdmin(args: {
  conversationId: string;
  adminUserId: string;
}): Promise<ChatConversationRow> {
  const nowIso = new Date().toISOString();
  return updateConversation(args.conversationId, {
    status: 'ADMIN_ACTIVE',
    assigned_admin_user_id: args.adminUserId,
    admin_claimed_at: nowIso,
    closed_at: null,
  });
}

export async function closeConversation(args: {
  conversationId: string;
  adminUserId: string;
}): Promise<ChatConversationRow> {
  const nowIso = new Date().toISOString();
  return updateConversation(args.conversationId, {
    status: 'CLOSED',
    assigned_admin_user_id: args.adminUserId,
    closed_at: nowIso,
  });
}

export async function closeConversationAndCreateFreshUserThread(args: {
  conversationId: string;
  adminUserId: string;
}): Promise<ChatConversationRow> {
  const conversation = await getConversationById(args.conversationId);
  if (!conversation) {
    throw new Error('Conversazione non trovata.');
  }

  const closedConversation = await closeConversation(args);
  const activeConversation = await getUserActiveConversation(conversation.user_id);

  if (!activeConversation) {
    await createConversation({ userId: conversation.user_id });
  }

  return closedConversation;
}

export async function reopenConversation(args: {
  conversationId: string;
  adminUserId?: string | null;
}): Promise<ChatConversationRow> {
  return updateConversation(args.conversationId, {
    status: args.adminUserId ? 'ADMIN_ACTIVE' : 'BOT_ACTIVE',
    assigned_admin_user_id: args.adminUserId ?? null,
    closed_at: null,
  });
}

export async function seedConversationTitleFromMessage(args: {
  conversation: ChatConversationRow;
  firstUserMessage: string;
}): Promise<ChatConversationRow> {
  if (args.conversation.title) return args.conversation;
  return updateConversation(args.conversation.id, {
    title: buildConversationTitle(args.firstUserMessage),
  });
}

export async function getUserThread(userId: string): Promise<{
  conversation: ChatConversationRow;
  messages: ChatMessageRow[];
}> {
  let conversation = await getLatestConversationForUser(userId);
  if (!conversation) {
    conversation = await createConversation({ userId });
  } else {
    conversation = await reconcileBotConversationForRead(conversation);
  }
  const messages = await listConversationMessages(conversation.id);
  return { conversation, messages };
}

export async function startNewUserConversation(userId: string): Promise<{
  conversation: ChatConversationRow;
  messages: ChatMessageRow[];
}> {
  const existing = await getUserActiveConversation(userId);

  if (existing) {
    await updateConversation(existing.id, {
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
    });
  }

  const conversation = await createConversation({ userId });
  return {
    conversation,
    messages: [],
  };
}

export async function listAdminChatConversations(args?: {
  status?: ChatConversationStatus | 'ACTIVE' | 'ALL';
  access?: AdminStaffAccess;
}): Promise<ChatAdminConversationListItem[]> {
  const status = args?.status ?? 'ACTIVE';
  const access = args?.access ?? null;

  if (access && !access.canManage && (status === 'BOT_ACTIVE' || status === 'CLOSED')) {
    return [];
  }

  let query = supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(100);

  if (access?.canManage) {
    if (status === 'ACTIVE') {
      query = query.in('status', ['HANDOFF_REQUESTED', 'ADMIN_ACTIVE']);
    } else if (status !== 'ALL') {
      query = query.eq('status', status);
    }
  } else if (access) {
    if (status === 'HANDOFF_REQUESTED') {
      query = query.eq('status', 'HANDOFF_REQUESTED');
    } else if (status === 'ADMIN_ACTIVE') {
      query = query.eq('status', 'ADMIN_ACTIVE');
    } else if (status === 'BOT_ACTIVE' || status === 'CLOSED') {
      return [];
    } else if (status === 'ACTIVE') {
      query = query.in('status', ['HANDOFF_REQUESTED', 'ADMIN_ACTIVE']);
    } else {
      query = query.in('status', ['HANDOFF_REQUESTED', 'ADMIN_ACTIVE']);
    }
  } else if (status === 'ACTIVE') {
    query = query.in('status', ['HANDOFF_REQUESTED', 'ADMIN_ACTIVE']);
  } else if (status !== 'ALL') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let conversations = (data ?? []).map(castConversation);
  conversations = await Promise.all(
    conversations.map((conversation) => reconcileBotConversationForRead(conversation))
  );

  if (status === 'BOT_ACTIVE') {
    conversations = conversations.filter((conversation) => conversation.status === 'BOT_ACTIVE');
  }

  if (access && !access.canManage) {
    conversations = conversations.filter(
      (conversation) =>
        conversation.status === 'HANDOFF_REQUESTED' ||
        conversation.assigned_admin_user_id === access.userId
    );
  }
  if (conversations.length === 0) return [];

  const userIds = Array.from(new Set(conversations.map((item) => item.user_id)));
  const conversationIds = conversations.map((item) => item.id);
  const adminIds = Array.from(
    new Set(conversations.map((item) => item.assigned_admin_user_id).filter((value): value is string => Boolean(value)))
  );

  const [
    { data: profilesData, error: profilesError },
    { data: dogsData, error: dogsError },
    { data: userMessagesData, error: userMessagesError },
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name, email, phone, city')
      .in('user_id', userIds),
    supabaseAdmin.from('dogs').select('owner_id, name').in('owner_id', userIds).eq('is_active', true),
    supabaseAdmin
      .from('chat_messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', conversationIds)
      .eq('sender_type', 'USER')
      .order('created_at', { ascending: false }),
  ]);

  if (profilesError) throw new Error(profilesError.message);
  if (dogsError) throw new Error(dogsError.message);
  if (userMessagesError) throw new Error(userMessagesError.message);

  const profileMap = new Map<string, ProfileSummary>();
  for (const row of (profilesData ?? []) as ProfileSummary[]) {
    profileMap.set(row.user_id, row);
  }

  const dogMap = new Map<string, string[]>();
  for (const row of (dogsData ?? []) as DogSummary[]) {
    const current = dogMap.get(row.owner_id) ?? [];
    if (row.name) current.push(row.name);
    dogMap.set(row.owner_id, current);
  }

  const userPreviewMap = new Map<string, string>();
  for (const row of (userMessagesData ?? []) as Array<{ conversation_id: string; body: string; created_at: string }>) {
    if (userPreviewMap.has(row.conversation_id)) continue;
    const preview = buildMessagePreview(row.body);
    if (preview) {
      userPreviewMap.set(row.conversation_id, preview);
    }
  }

  const adminLabelMap = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: adminProfiles, error: adminProfilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .in('user_id', adminIds);

    if (adminProfilesError) throw new Error(adminProfilesError.message);

    for (const profile of (adminProfiles ?? []) as Array<
      Pick<Profile, 'user_id' | 'first_name' | 'last_name' | 'email'>
    >) {
      const labelParts = [profile.first_name, profile.last_name]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean);
      const label = labelParts.join(' ') || profile.email || 'Admin';
      adminLabelMap.set(profile.user_id, label);
    }
  }

  return conversations.map((conversation) => {
    const profile = profileMap.get(conversation.user_id) ?? null;
    const userName = formatFullName(profile);

    return {
      id: conversation.id,
      userId: conversation.user_id,
      userName,
      userEmail: profile?.email ?? null,
      userPhone: profile?.phone ?? null,
      status: conversation.status,
      handoffReason: conversation.handoff_reason,
      handoffSummary: conversation.handoff_summary,
      assignedAdminUserId: conversation.assigned_admin_user_id,
      assignedAdminLabel: conversation.assigned_admin_user_id
        ? adminLabelMap.get(conversation.assigned_admin_user_id) ?? 'Admin'
        : null,
      lastMessageAt: conversation.last_message_at,
      lastMessagePreview: userPreviewMap.get(conversation.id) ?? null,
      createdAt: conversation.created_at,
    };
  });
}

export async function getAdminConversationDetail(
  conversationId: string
): Promise<ChatAdminConversationDetail | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) return null;

  const messages = await listConversationMessages(conversationId);

  const [{ data: profileData, error: profileError }, { data: dogsData, error: dogsError }] =
    await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name, email, phone, city')
        .eq('user_id', conversation.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from('dogs')
        .select('owner_id, name')
        .eq('owner_id', conversation.user_id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);

  if (profileError) throw new Error(profileError.message);
  if (dogsError) throw new Error(dogsError.message);

  const profile = (profileData as ProfileSummary | null) ?? null;

  return {
    conversation,
    messages,
    user: {
      userId: conversation.user_id,
      fullName: formatFullName(profile),
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      city: profile?.city ?? null,
      dogNames: ((dogsData ?? []) as DogSummary[]).map((dog) => dog.name).filter(Boolean) as string[],
    },
  };
}
