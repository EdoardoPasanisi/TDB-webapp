'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { UserChatPage } from '@/components/chat/UserChatPage';

type ConversationListItem = {
  id: string;
  title: string | null;
  status: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  createdAt: string;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string): string {
  if (status === 'HANDOFF_REQUESTED' || status === 'ADMIN_ACTIVE') return 'Operatore';
  if (status === 'CLOSED') return 'Chiusa';
  return 'Assistente';
}

export function ChatHome() {
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadList = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const response = await fetch('/api/chat?list=1', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await response.json().catch(() => null)) as
        | { conversations?: ConversationListItem[] }
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(String(json && 'error' in json ? json.error ?? '' : '').trim() || 'Errore storico chat.');
      }
      setConversations((json as { conversations?: ConversationListItem[] })?.conversations ?? []);
      setState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare lo storico delle chat.'));
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!user?.id || selectedId) return;
    void loadList();
  }, [user?.id, selectedId, loadList]);

  const startNewChat = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch('/api/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ action: 'new' }),
      });
      const json = (await response.json().catch(() => null)) as
        | { conversation?: { id: string } }
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(String(json && 'error' in json ? json.error ?? '' : '').trim() || 'Nuova chat non disponibile.');
      }
      const id = (json as { conversation?: { id: string } })?.conversation?.id;
      if (id) setSelectedId(id);
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a iniziare una nuova chat.'));
    } finally {
      setStarting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento chat…</p>
      </main>
    );
  }
  if (!user) return null;

  if (selectedId) {
    return <UserChatPage conversationId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4 space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="ui-title text-[24px]">Assistenza</h1>
                <p className="ui-muted mt-1">Le tue conversazioni. Le chat più vecchie di 3 mesi vengono rimosse.</p>
              </div>
              <Button variant="primary" className="ui-btnCompact shrink-0" disabled={starting} onClick={() => void startNewChat()}>
                {starting ? '…' : 'Nuova chat'}
              </Button>
            </div>
            {error ? <div className="ui-error">{error}</div> : null}
          </CardContent>
        </Card>

        {state === 'loading' || state === 'idle' ? (
          <Card>
            <CardContent className="flex items-center gap-3">
              <div className="ui-spinner" />
              <span className="ui-muted">Caricamento storico…</span>
            </CardContent>
          </Card>
        ) : null}

        {state === 'ready' && conversations.length === 0 ? (
          <Card>
            <CardContent className="ui-muted text-center py-6">
              Non hai ancora nessuna conversazione. Tocca <strong>Nuova chat</strong> per iniziare.
            </CardContent>
          </Card>
        ) : null}

        {conversations.map((conversation) => (
          <button key={conversation.id} type="button" className="w-full text-left" onClick={() => setSelectedId(conversation.id)}>
            <Card className="admin-listCard">
              <CardContent className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="ui-body font-[var(--font-weight-semibold)] truncate">
                    {conversation.title?.trim() || 'Conversazione'}
                  </div>
                  <span className="ui-accentPill shrink-0">{statusLabel(conversation.status)}</span>
                </div>
                {conversation.lastMessagePreview ? (
                  <div className="ui-muted truncate">{conversation.lastMessagePreview}</div>
                ) : null}
                <div className="ui-muted text-[12px]">{formatDateTime(conversation.lastMessageAt)}</div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </main>
  );
}
