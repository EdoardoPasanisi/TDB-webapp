'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { ChatMessageRow, ChatUserThreadResponse } from '@/types/chat';
import { Button } from '@/components/ui/Button';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const BOT_IDLE_WARNING_MS = 5 * 60 * 1000;
const BOT_IDLE_CLOSE_MS = 10 * 60 * 1000;
const DESKTOP_CHAT_COMPOSER_LIFT = 44;

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 3L10 14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 3L14 21l-4-7-7-4 18-7z" />
    </svg>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function bubbleClass(message: ChatMessageRow): string {
  if (message.sender_type === 'USER') {
    return 'ml-auto bg-[rgba(255,130,0,0.18)] border-[rgba(255,130,0,0.44)]';
  }
  if (message.sender_type === 'ADMIN') {
    return 'mr-auto bg-[rgba(59,130,246,0.14)] border-[rgba(59,130,246,0.38)]';
  }
  if (message.sender_type === 'SYSTEM') {
    return 'mr-auto bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.10)]';
  }
  return 'mr-auto bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.14)]';
}

async function fetchThread(signal?: AbortSignal): Promise<ChatUserThreadResponse> {
  const response = await fetch('/api/chat', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
  });

  const json = (await response.json().catch(() => null)) as
    | ChatUserThreadResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new Error(String(json && 'error' in json ? json.error ?? '' : '').trim() || 'Errore chat.');
  }

  return json as ChatUserThreadResponse;
}

function getDisplayLabel(message: ChatMessageRow): string | null {
  if (message.sender_type === 'ASSISTANT') return 'Assistente';
  if (message.sender_type === 'SYSTEM') return 'Sistema';
  return null;
}

export function UserChatPage() {
  const { user, loading: authLoading, error: authError } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [state, setState] = useState<LoadState>('idle');
  const [thread, setThread] = useState<ChatUserThreadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatMessageRow | null>(null);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(64);
  const [composerHeight, setComposerHeight] = useState(92);
  const [isDesktop, setIsDesktop] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const topError = error ?? (authError ? humanizeErrorMessage(authError, 'Accesso chat non disponibile.') : null);
  const isOperatorMode =
    thread?.conversation.status === 'HANDOFF_REQUESTED' || thread?.conversation.status === 'ADMIN_ACTIVE';
  const isClosed = thread?.conversation.status === 'CLOSED';

  async function load(silent = false) {
    if (!silent) setState('loading');
    setError(null);
    try {
      const nextThread = await fetchThread();
      setThread(nextThread);
      setState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare la chat.'));
      setState('error');
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    void load();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setInterval(() => {
      if (sending) return;
      void load(true);
    }, 10000);
    return () => {
      window.clearInterval(timer);
    };
  }, [user?.id, sending]);

  useEffect(() => {
    if (!user?.id) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !sending) {
        void load(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, sending]);

  useEffect(() => {
    if (!thread || sending || thread.conversation.status !== 'BOT_ACTIVE') return;

    const lastMessageAt = new Date(thread.conversation.last_message_at).getTime();
    if (!Number.isFinite(lastMessageAt)) return;

    const now = Date.now();
    const warningDelay = Math.max(0, lastMessageAt + BOT_IDLE_WARNING_MS - now + 1000);
    const closeDelay = Math.max(0, lastMessageAt + BOT_IDLE_CLOSE_MS - now + 1000);
    const nextDelay = now < lastMessageAt + BOT_IDLE_WARNING_MS ? warningDelay : closeDelay;

    const timeoutId = window.setTimeout(() => {
      void load(true);
    }, nextDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [thread, sending]);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    let raf1 = 0;
    let raf2 = 0;

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        node.scrollTop = node.scrollHeight;
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [thread, pendingUserMessage, assistantTyping]);

  useLayoutEffect(() => {
    const updateChromeHeights = () => {
      const header = headerRef.current;
      const composer = composerRef.current;
      setIsDesktop(window.innerWidth >= 768);
      if (header) setHeaderHeight(Math.ceil(header.getBoundingClientRect().height));
      if (composer) setComposerHeight(Math.ceil(composer.getBoundingClientRect().height));
    };

    updateChromeHeights();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateChromeHeights) : null;
    if (headerRef.current) resizeObserver?.observe(headerRef.current);
    if (composerRef.current) resizeObserver?.observe(composerRef.current);
    window.addEventListener('resize', updateChromeHeights);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateChromeHeights);
    };
  }, [thread?.conversation.status, topError]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(88, textarea.scrollHeight)}px`;
  }, [draft]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousChatLayout = document.body.dataset.chatLayout;
    document.body.dataset.chatLayout = 'immersive';

    return () => {
      if (previousChatLayout) {
        document.body.dataset.chatLayout = previousChatLayout;
        return;
      }
      delete document.body.dataset.chatLayout;
    };
  }, []);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || sending || !thread) return;

    const optimisticMessage: ChatMessageRow = {
      id: `temp-${Date.now()}`,
      conversation_id: thread.conversation.id,
      sender_type: 'USER',
      admin_user_id: null,
      body: message,
      metadata: { optimistic: true },
      created_at: new Date().toISOString(),
    };

    setSending(true);
    setError(null);
    setDraft('');
    setPendingUserMessage(optimisticMessage);
    setAssistantTyping(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ message }),
      });

      const json = (await response.json().catch(() => null)) as
        | ChatUserThreadResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(String(json && 'error' in json ? json.error ?? '' : '').trim() || 'Invio fallito.');
      }

      setThread(json as ChatUserThreadResponse);
      setPendingUserMessage(null);
      setAssistantTyping(false);
      setState('ready');
    } catch (err) {
      setDraft(message);
      setPendingUserMessage(null);
      setAssistantTyping(false);
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a inviare il messaggio.'));
    } finally {
      setSending(false);
    }
  }

  async function startNewChat() {
    if (sending) return;
    setSending(true);
    setError(null);
    setPendingUserMessage(null);
    setAssistantTyping(false);
    try {
      const response = await fetch('/api/chat', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ action: 'new' }),
      });

      const json = (await response.json().catch(() => null)) as
        | ChatUserThreadResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(
          String(json && 'error' in json ? json.error ?? '' : '').trim() || 'Nuova chat non disponibile.'
        );
      }

      setThread(json as ChatUserThreadResponse);
      setDraft('');
      setState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a iniziare una nuova chat.'));
    } finally {
      setSending(false);
    }
  }

  if (authLoading) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento chat…</p>
      </main>
    );
  }

  if (!user) return null;

  const visibleMessages = thread
    ? pendingUserMessage
      ? [...thread.messages, pendingUserMessage]
      : thread.messages
    : [];

  return (
    <main className="-mx-4 h-full min-h-0 overflow-hidden bg-[var(--brand-bg)] text-[var(--text)] md:mx-0">
      <div className="relative mx-auto h-full min-h-0 w-full max-w-5xl overflow-hidden bg-[var(--brand-bg)] md:h-full md:min-h-0 md:px-4">
        <div
          ref={headerRef}
          className="absolute inset-x-0 top-0 z-20 border-b border-[var(--border)] bg-[rgba(6,8,7,0.96)] px-8 pb-3 pt-2 backdrop-blur md:mt-4 md:rounded-[var(--radius)] md:border md:bg-[var(--surface)] md:px-4 md:pt-4 md:shadow-[var(--shadow)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="ui-title truncate text-[22px]">Assistenza</h1>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="secondary"
                className="ui-btnCompact !h-8 rounded-full !px-2.5 text-[12px]"
                onClick={() => void startNewChat()}
                disabled={sending || isOperatorMode}
              >
                Nuova chat
              </Button>
            </div>
          </div>

          {isOperatorMode ? (
            <div className="ui-panelInset mt-3 p-3">
              <div className="ui-body font-[var(--font-weight-semibold)]">Chat affidata a un operatore</div>
              <div className="ui-muted mt-1">
                Un operatore rispondera il prima possibile, puoi anche uscire dalla chat.
              </div>
              <div className="ui-muted mt-1">
                Finchè questa richiesta è aperta non puoi avviare una nuova chat.
              </div>
            </div>
          ) : null}

          {isClosed ? (
            <div className="ui-panelInset mt-3 p-3">
              <div className="ui-body font-[var(--font-weight-semibold)]">Chat chiusa</div>
              <div className="ui-muted mt-1">
                Questa conversazione e stata chiusa. Se ti serve ancora aiuto, puoi iniziarne una nuova.
              </div>
            </div>
          ) : null}
        </div>

        {state === 'loading' || state === 'idle' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4 md:px-0">
            <div className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 md:max-w-xl">
              <div className="ui-spinner" />
              <div className="ui-muted">Preparazione conversazione…</div>
            </div>
          </div>
        ) : null}

        {thread ? (
          <div
            ref={scrollRef}
            className="absolute inset-x-0 z-10 flex flex-col gap-3 overflow-y-auto overscroll-contain px-4 md:px-0"
            style={{
              WebkitOverflowScrolling: 'touch',
              top: headerHeight + 16,
              bottom: composerHeight + (isDesktop ? DESKTOP_CHAT_COMPOSER_LIFT + 12 : 12),
            }}
          >
            {visibleMessages.length === 0 ? (
              <div className="ui-emptyState my-auto">
                <div className="ui-body font-[var(--font-weight-semibold)]">Nessun messaggio ancora</div>
                <div className="ui-muted mt-1">
                  Inizia la conversazione per ricevere assistenza o richiedere un operatore.
                </div>
              </div>
            ) : null}

            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-[calc(var(--radius)-2px)] border px-3 py-2 ${bubbleClass(message)}`}
              >
                {getDisplayLabel(message) ? (
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`ui-body font-[var(--font-weight-semibold)] ${
                        message.sender_type === 'ASSISTANT' ? 'ui-accentText' : ''
                      }`}
                    >
                      {getDisplayLabel(message)}
                    </div>
                    <div className="ui-fine">{formatDateTime(message.created_at)}</div>
                  </div>
                ) : null}
                <div className="ui-body mt-1 whitespace-pre-wrap break-words">{message.body}</div>
                {!getDisplayLabel(message) ? (
                  <div className="mt-1 text-right ui-fine">{formatDateTime(message.created_at)}</div>
                ) : null}
              </div>
            ))}

            {assistantTyping ? (
              <div className="mr-auto max-w-[88%] rounded-[calc(var(--radius)-2px)] border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-3 py-3">
                <div className="ui-body animate-pulse">Sta scrivendo...</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {topError ? (
          <div
            className="absolute inset-x-0 z-30 px-8 md:px-0"
            style={{ top: headerHeight + 8 }}
          >
            <div className="ui-error">{topError}</div>
          </div>
        ) : null}

        {thread && !isClosed ? (
          <div
            ref={composerRef}
            className="absolute inset-x-0 bottom-0 z-20"
            style={{
              bottom: isDesktop ? DESKTOP_CHAT_COMPOSER_LIFT : 0,
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-b from-transparent to-[var(--brand-bg)] md:hidden" />
            <div className="ui-chatComposerDock">
              <div className="mx-auto w-full max-w-5xl">
                <div className="border-t border-[var(--border)] bg-[var(--brand-bg)] px-4 pb-4 pt-3 md:rounded-[var(--radius)] md:border md:bg-[var(--surface)] md:shadow-[var(--shadow)]">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      className="ui-control min-w-0 flex-1 resize-none overflow-hidden rounded-[var(--radius)] px-4 py-3 leading-6"
                      placeholder={
                        isOperatorMode
                          ? 'Scrivi qui: il messaggio resterà nella stessa conversazione.'
                          : 'Scrivi un messaggio…'
                      }
                      rows={2}
                      disabled={sending}
                    />
                    <Button
                      variant="primary"
                      className="h-11 w-11 shrink-0 self-end rounded-full !px-0"
                      onClick={() => void sendMessage()}
                      disabled={sending || !draft.trim()}
                      aria-label={sending ? 'Invio in corso' : 'Invia messaggio'}
                    >
                      <IconSend />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
