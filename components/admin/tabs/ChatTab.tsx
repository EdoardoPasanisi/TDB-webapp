'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import type { AdminStaffAccess } from '@/lib/admin/types';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import {
  getChatHandoffReasonLabel,
  getChatSenderLabel,
  getChatStatusLabel,
} from '@/lib/chat/format';
import type {
  ChatAdminConversationDetail,
  ChatAdminConversationListItem,
  ChatConversationStatus,
} from '@/types/chat';
import { Modal } from '@/components/common/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  EmptyCard,
  ErrorCard,
  LoadingCard,
  cx,
  formatDateTime,
} from '@/components/admin/shared';

type StatusFilter = ChatConversationStatus | 'ALL';

type ChatTabProps = {
  access: AdminStaffAccess;
};

export function ChatTab({ access }: ChatTabProps) {
  const [filter, setFilter] = useState<StatusFilter>('HANDOFF_REQUESTED');
  const [query, setQuery] = useState('');
  const [listState, setListState] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [items, setItems] = useState<ChatAdminConversationListItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChatAdminConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [mutating, setMutating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canManage = access.canManage;
  const filterOptions = canManage
    ? (['BOT_ACTIVE', 'HANDOFF_REQUESTED', 'ADMIN_ACTIVE', 'CLOSED', 'ALL'] as StatusFilter[])
    : (['HANDOFF_REQUESTED', 'ADMIN_ACTIVE', 'ALL'] as StatusFilter[]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) => {
      const haystack = [
        item.userName,
        item.userEmail,
        item.userPhone,
        item.handoffSummary,
        item.lastMessagePreview,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query]);

  const loadList = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (!silent) setListState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<{ items: ChatAdminConversationListItem[] }>(
        `/api/admin/chat/conversations?status=${encodeURIComponent(filter)}`,
        { signal }
      );
      setItems(data.items);
      setSelectedConversationId((current) => (current && data.items.some((item) => item.id === current) ? current : null));
      setListState('ready');
    } catch (err) {
      if (isAbortError(err)) return;
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare le conversazioni chat.'));
      setListState('error');
    }
  }, [filter]);

  const loadDetail = useCallback(async (conversationId: string, signal?: AbortSignal, silent = false) => {
    if (!silent) {
      setDetailState((current) => (current === 'ready' ? current : 'loading'));
    }
    setError(null);
    try {
      const data = await fetchAdminJson<ChatAdminConversationDetail>(
        `/api/admin/chat/conversations/${conversationId}`,
        { signal }
      );
      setDetail(data);
      setDetailState('ready');
    } catch (err) {
      if (isAbortError(err)) return;
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio della chat.'));
      setDetailState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadList(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedConversationId) {
      setDetail(null);
      setDetailState('idle');
      return;
    }

    const controller = new AbortController();
    setDetailState('loading');
    void loadDetail(selectedConversationId, controller.signal);
    return () => {
      controller.abort();
    };
  }, [selectedConversationId, loadDetail]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadList(undefined, true);
      if (selectedConversationId) {
        void loadDetail(selectedConversationId, undefined, true);
      }
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, [selectedConversationId, loadDetail, loadList]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [detail]);

  useEffect(() => {
    setReplyDraft('');
  }, [selectedConversationId]);

  async function mutateConversation(conversationId: string, action: 'claim' | 'close' | 'reopen') {
    if (!conversationId || mutating) return;
    setMutating(true);
    setError(null);
    try {
      const data = await fetchAdminJson<ChatAdminConversationDetail>(
        `/api/admin/chat/conversations/${conversationId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action }),
        }
      );
      setDetail(data);
      setSelectedConversationId(conversationId);
      await loadList();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti ad aggiornare lo stato della conversazione.'));
    } finally {
      setMutating(false);
    }
  }

  function closeDetailView() {
    setSelectedConversationId(null);
    setDetail(null);
    setDetailState('idle');
    setReplyDraft('');
  }

  async function sendReply() {
    if (!selectedConversationId || sendingReply || !replyDraft.trim()) return;
    setSendingReply(true);
    setError(null);
    try {
      const data = await fetchAdminJson<ChatAdminConversationDetail>(
        `/api/admin/chat/conversations/${selectedConversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ message: replyDraft.trim() }),
        }
      );
      setDetail(data);
      setReplyDraft('');
      await loadList();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a inviare la risposta admin.'));
    } finally {
      setSendingReply(false);
    }
  }

  function isAssignedToCurrentStaff(item: {
    assignedAdminUserId?: string | null;
    conversation?: { assigned_admin_user_id: string | null };
  }): boolean {
    if ('conversation' in item && item.conversation) {
      return item.conversation.assigned_admin_user_id === access.userId;
    }
    return item.assignedAdminUserId === access.userId;
  }

  function canClaimItem(item: ChatAdminConversationListItem): boolean {
    if (item.status === 'CLOSED') return false;
    if (canManage) return item.assignedAdminUserId !== access.userId;
    return item.status === 'HANDOFF_REQUESTED';
  }

  const canReplyDetail = Boolean(
    detail &&
      (canManage ||
        detail.conversation.status === 'HANDOFF_REQUESTED' ||
        detail.conversation.assigned_admin_user_id === access.userId)
  );
  const canCloseDetail = Boolean(
    detail &&
      detail.conversation.status === 'ADMIN_ACTIVE' &&
      (canManage || detail.conversation.assigned_admin_user_id === access.userId)
  );
  const canReopenDetail = Boolean(
    detail &&
      detail.conversation.status === 'CLOSED' &&
      canManage
  );
  const canClaimDetail = Boolean(
    detail &&
      detail.conversation.status !== 'CLOSED' &&
      (canManage
        ? detail.conversation.assigned_admin_user_id !== access.userId
        : detail.conversation.status === 'HANDOFF_REQUESTED')
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="Inbox chat"
              subtitle={
                canManage
                  ? 'Assistente, richieste operatore, chat in carico e archivio chat chiuse.'
                  : 'Richieste operatore e conversazioni prese in carico da te.'
              }
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-control ui-input"
              placeholder="Cerca per cliente o messaggio..."
            />
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={cx('admin-tabButton', filter === status && 'admin-tabButton--active')}
                >
                  {status === 'BOT_ACTIVE'
                    ? 'Assistente'
                    : status === 'HANDOFF_REQUESTED'
                      ? 'Richiesta operatore'
                      : status === 'ADMIN_ACTIVE'
                        ? 'Operatore'
                        : status === 'CLOSED'
                          ? 'Chiusa'
                          : 'Tutte'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && !selectedConversationId ? <div className="ui-error">{error}</div> : null}
        {listState === 'loading' || listState === 'idle' ? <LoadingCard label="Caricamento conversazioni..." /> : null}
        {listState === 'error' ? <ErrorCard error={error ?? 'Errore chat.'} onRetry={() => void loadList()} /> : null}
        {listState === 'ready' && filteredItems.length === 0 ? (
          <EmptyCard label="Nessuna conversazione trovata con i filtri attuali." />
        ) : null}

        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className={cx('admin-listCard', selectedConversationId === item.id && 'admin-selectedCard')}
          >
            <CardContent className="space-y-3">
              <button type="button" onClick={() => setSelectedConversationId(item.id)} className="block w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="ui-body truncate font-[var(--font-weight-semibold)]">{item.userName}</div>
                    <div className="ui-muted truncate">{item.userEmail ?? item.userPhone ?? 'Contatto non disponibile'}</div>
                  </div>
                  <span className="ui-accentPill">{getChatStatusLabel(item.status)}</span>
                </div>

                <div className="mt-3 space-y-2">
                  {item.handoffSummary ? (
                    <div className="ui-muted">
                      <span className="font-[var(--font-weight-semibold)] text-[var(--text)]">Motivo:</span> {item.handoffSummary}
                    </div>
                  ) : null}
                  <div className="ui-muted">
                    <span className="font-[var(--font-weight-semibold)] text-[var(--text)]">Ultimo messaggio cliente:</span>{' '}
                    {item.lastMessagePreview || 'Nessun messaggio disponibile.'}
                  </div>
                </div>
              </button>

              <div className="flex flex-wrap gap-2">
                {item.handoffReason ? (
                  <span className="ui-accentPill">{getChatHandoffReasonLabel(item.handoffReason)}</span>
                ) : null}
                {item.assignedAdminLabel ? (
                  <span className="ui-accentPill">
                    {isAssignedToCurrentStaff(item) ? 'In carico a te' : `In carico: ${item.assignedAdminLabel}`}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="ui-fine">Ultimo aggiornamento: {formatDateTime(item.lastMessageAt)}</div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    className="ui-btnCompact"
                    onClick={() => setSelectedConversationId(item.id)}
                  >
                    Apri chat
                  </Button>
                  {canClaimItem(item) ? (
                    <Button
                      variant="primary"
                      className="ui-btnCompact"
                      disabled={mutating}
                      onClick={() => void mutateConversation(item.id, 'claim')}
                    >
                      Prendi in carico
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(selectedConversationId)}
        title={detail?.user.fullName || 'Chat assistenza'}
        onClose={closeDetailView}
      >
        {detailState === 'loading' || detailState === 'idle' ? (
          <LoadingCard label="Caricamento dettaglio chat..." />
        ) : detailState === 'error' || !detail ? (
          <ErrorCard
            error={error ?? 'Non siamo riusciti a caricare il dettaglio della chat.'}
            onRetry={() => {
              if (selectedConversationId) {
                void loadDetail(selectedConversationId);
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            <Card className="admin-heroCard">
              <CardContent className="space-y-4">
                <SectionHeader
                  title={detail.user.fullName}
                  subtitle={[
                    detail.user.email,
                    detail.user.phone,
                    detail.user.city,
                    detail.user.dogNames.length > 0 ? `Cani: ${detail.user.dogNames.join(', ')}` : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                  action={<span className="ui-accentPill">{getChatStatusLabel(detail.conversation.status)}</span>}
                />

                <div className="flex flex-wrap gap-2">
                  {detail.conversation.handoff_reason ? (
                    <span className="ui-accentPill">
                      {getChatHandoffReasonLabel(detail.conversation.handoff_reason)}
                    </span>
                  ) : null}
                  {detail.conversation.handoff_summary ? (
                    <span className="ui-accentPill">{detail.conversation.handoff_summary}</span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {canClaimDetail ? (
                    <Button
                      variant="secondary"
                      onClick={() => void mutateConversation(detail.conversation.id, 'claim')}
                      disabled={mutating}
                    >
                      Prendi in carico
                    </Button>
                  ) : null}
                  {canReopenDetail ? (
                    <Button
                      variant="secondary"
                      onClick={() => void mutateConversation(detail.conversation.id, 'reopen')}
                      disabled={mutating}
                    >
                      Riapri
                    </Button>
                  ) : null}
                  {canCloseDetail ? (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          'Vuoi davvero chiudere questa conversazione? Per il cliente verra preparata subito una nuova chat vuota.'
                        );
                        if (!confirmed) return;
                        await mutateConversation(detail.conversation.id, 'close');
                      }}
                      disabled={mutating}
                    >
                      Chiudi chat
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="min-h-[60vh]">
              <CardContent className="flex min-h-[60vh] flex-col gap-4">
                <div
                  ref={scrollRef}
                  className="flex min-h-[360px] flex-1 flex-col gap-3 overflow-y-auto rounded-[calc(var(--radius)-4px)] border border-[var(--border)] bg-[var(--surface-2)] p-3"
                >
                  {detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cx(
                        'max-w-[88%] rounded-[calc(var(--radius)-2px)] border px-3 py-2',
                        message.sender_type === 'USER'
                          ? 'mr-auto border-[rgba(255,130,0,0.30)] bg-[rgba(255,130,0,0.10)]'
                          : message.sender_type === 'ADMIN'
                            ? 'ml-auto border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.12)]'
                            : 'mr-auto border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="ui-body font-[var(--font-weight-semibold)]">
                          {getChatSenderLabel(message.sender_type)}
                        </div>
                        <div className="ui-fine">{formatDateTime(message.created_at)}</div>
                      </div>
                      <div className="ui-body mt-1 whitespace-pre-wrap break-words">{message.body}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    className="ui-control w-full rounded-[var(--radius)] px-4 py-3 leading-6"
                    rows={4}
                    placeholder="Scrivi la risposta…"
                    disabled={sendingReply || !canReplyDetail}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="primary"
                      onClick={() => void sendReply()}
                      disabled={sendingReply || !replyDraft.trim() || !canReplyDetail}
                    >
                      {sendingReply ? 'Invio…' : 'Invia risposta'}
                    </Button>
                  </div>
                  {!canReplyDetail ? (
                    <div className="ui-muted">
                      Puoi rispondere solo alle chat pendenti oppure alle chat gia prese in carico da te.
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
