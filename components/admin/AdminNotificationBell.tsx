'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffNotificationRow } from '@/types/adminNotifications';

type StaffNotificationsApiResponse =
  | {
      ok: true;
      items: StaffNotificationRow[];
      unreadCount: number;
    }
  | {
      ok: false;
      error: string;
    };

const POLL_INTERVAL_MS = 30_000;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M12 4.75a4 4 0 0 0-4 4v1.19c0 .88-.29 1.74-.84 2.43l-1.1 1.4a1.75 1.75 0 0 0 1.37 2.83h9.14a1.75 1.75 0 0 0 1.37-2.83l-1.1-1.4A3.9 3.9 0 0 1 16 9.94V8.75a4 4 0 0 0-4-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.75 18.25a2.25 2.25 0 0 0 4.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60000));

  if (diffMin < 1) return 'Ora';
  if (diffMin < 60) return `${diffMin} min fa`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h fa`;

  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminNotificationBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<StaffNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useMemo(
    () => async () => {
      try {
        setError(null);
        const response = await fetch('/api/admin/notifications?limit=12', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });
        const json = (await response.json().catch(() => null)) as StaffNotificationsApiResponse | null;
        if (!response.ok || !json?.ok) {
          throw new Error(
            json && !json.ok && json.error
              ? json.error
              : 'Non siamo riusciti a caricare le notifiche del gestionale.'
          );
        }

        setItems(json.items);
        setUnreadCount(json.unreadCount);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Non siamo riusciti a caricare le notifiche del gestionale.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function markOneAsRead(notificationId: string) {
    await fetch(`/api/admin/notifications/${notificationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'mark_read' }),
    });
  }

  async function handleNotificationClick(item: StaffNotificationRow) {
    const href =
      item.data_json && typeof item.data_json === 'object' && 'href' in item.data_json
        ? String(item.data_json.href ?? '')
        : '';

    if (!item.read_at) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      void markOneAsRead(item.id);
    }

    setOpen(false);
    if (href) router.push(href);
  }

  async function handleMarkAllRead() {
    setItems((current) =>
      current.map((entry) => (entry.read_at ? entry : { ...entry, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
  }

  return (
    <div ref={rootRef} className="ui-notificationBell">
      <button
        type="button"
        className={cx('ui-desktopTopIconBtn', unreadCount > 0 && 'ui-notificationBellBtn--active')}
        aria-label="Notifiche gestionale"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void fetchNotifications();
        }}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="ui-notificationBadge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="ui-notificationPanel ui-notificationPanel--desktop">
          <div className="ui-notificationPanel__header">
            <div>
              <div className="ui-body font-[var(--font-weight-bold)]">Notifiche gestionale</div>
              <div className="ui-muted">
                {unreadCount > 0 ? `${unreadCount} non lette` : 'Tutto aggiornato'}
              </div>
            </div>

            <button
              type="button"
              className="ui-notificationPanel__link"
              disabled={unreadCount === 0}
              onClick={() => void handleMarkAllRead()}
            >
              Segna tutte lette
            </button>
          </div>

          <div className="ui-notificationPanel__body">
            {loading ? (
              <div className="ui-notificationEmpty">Caricamento notifiche…</div>
            ) : error ? (
              <div className="ui-notificationEmpty ui-dangerText">{error}</div>
            ) : items.length === 0 ? (
              <div className="ui-notificationEmpty">Nessuna notifica operativa per ora.</div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cx('ui-notificationItem', !item.read_at && 'ui-notificationItem--unread')}
                    onClick={() => void handleNotificationClick(item)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="ui-body font-[var(--font-weight-semibold)] break-words">
                          {item.title}
                        </div>
                        <div className="ui-muted mt-1 break-words">{item.body}</div>
                      </div>
                      <div className="ui-fine shrink-0 text-[var(--muted)]">
                        {formatNotificationTime(item.created_at)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
