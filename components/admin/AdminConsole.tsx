'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { AdminStaffAccess } from '@/lib/admin/types';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import {
  ADMIN_ACCESS_STORAGE_KEY,
  ADMIN_TAB_STORAGE_KEY,
  ADMIN_TABS,
  LoadingCard,
  getStorage,
  setStorage,
  type AdminTab,
  type LoadState,
  cx,
} from '@/components/admin/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const OverviewTab = dynamic(
  () => import('@/components/admin/tabs/OverviewTab').then((mod) => mod.OverviewTab),
  { loading: () => <LoadingCard label="Caricamento overview..." /> }
);
const AnalyticsTab = dynamic(
  () => import('@/components/admin/tabs/AnalyticsTab').then((mod) => mod.AnalyticsTab),
  { loading: () => <LoadingCard label="Caricamento analisi..." /> }
);
const UsersTab = dynamic(
  () => import('@/components/admin/tabs/UsersTab').then((mod) => mod.UsersTab),
  { loading: () => <LoadingCard label="Caricamento clienti..." /> }
);
const DogsTab = dynamic(
  () => import('@/components/admin/tabs/DogsTab').then((mod) => mod.DogsTab),
  { loading: () => <LoadingCard label="Caricamento cani..." /> }
);
const ServicesTab = dynamic(
  () => import('@/components/admin/tabs/ServicesTab').then((mod) => mod.ServicesTab),
  { loading: () => <LoadingCard label="Caricamento servizi..." /> }
);
const ChatTab = dynamic(
  () => import('@/components/admin/tabs/ChatTab').then((mod) => mod.ChatTab),
  { loading: () => <LoadingCard label="Caricamento chat..." /> }
);
const MediaTab = dynamic(
  () => import('@/components/admin/tabs/MediaTab').then((mod) => mod.MediaTab),
  { loading: () => <LoadingCard label="Caricamento media..." /> }
);
const ConfigTab = dynamic(
  () => import('@/components/admin/tabs/ConfigTab').then((mod) => mod.ConfigTab),
  { loading: () => <LoadingCard label="Caricamento configurazione..." /> }
);

export function AdminConsole({ initialTabFromQuery = null }: { initialTabFromQuery?: string | null }) {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [tab, setTab] = useState<AdminTab>(() => {
    if (initialTabFromQuery && ADMIN_TABS.some((item) => item.key === initialTabFromQuery)) {
      return initialTabFromQuery as AdminTab;
    }
    const stored = getStorage<string>(ADMIN_TAB_STORAGE_KEY, 'overview');
    return ADMIN_TABS.some((item) => item.key === stored) ? (stored as AdminTab) : 'overview';
  });
  const [access, setAccess] = useState<AdminStaffAccess | null>(() =>
    getStorage<AdminStaffAccess | null>(ADMIN_ACCESS_STORAGE_KEY, null)
  );
  const [accessState, setAccessState] = useState<LoadState>(() =>
    getStorage<AdminStaffAccess | null>(ADMIN_ACCESS_STORAGE_KEY, null) ? 'ready' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const cachedAccessRef = useRef<AdminStaffAccess | null>(access);

  useEffect(() => {
    setStorage(ADMIN_TAB_STORAGE_KEY, tab);
  }, [tab]);

  useEffect(() => {
    cachedAccessRef.current = access;
  }, [access]);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    async function loadAccess() {
      if (!cachedAccessRef.current) {
        setAccessState('loading');
      }
      setError(null);

      try {
        const payload = await fetchAdminJson<AdminStaffAccess>('/api/admin/me', { signal: controller.signal });
        setAccess(payload);
        setAccessState('ready');
        setStorage(ADMIN_ACCESS_STORAGE_KEY, payload);
      } catch (err) {
        if (isAbortError(err)) return;
        setAccess(null);
        setStorage(ADMIN_ACCESS_STORAGE_KEY, null);
        setError(
          humanizeErrorMessage(err, 'Il gestionale non è disponibile in questo momento.')
        );
        setAccessState('error');
      }
    }

    void loadAccess();

    return () => {
      controller.abort();
    };
  }, [user]);

  const canManage = access?.canManage ?? false;
  const visibleTabs = canManage
    ? ADMIN_TABS
    : ADMIN_TABS.filter((item) => item.key !== 'config');
  const effectiveTab = !canManage && tab === 'config' ? 'overview' : tab;

  const tabContent = useMemo(() => {
    if (effectiveTab === 'overview') return <OverviewTab canManage={canManage} />;
    if (effectiveTab === 'analytics') return <AnalyticsTab />;
    if (effectiveTab === 'users') return <UsersTab canManage={canManage} />;
    if (effectiveTab === 'dogs') return <DogsTab canManage={canManage} />;
    if (effectiveTab === 'services') return <ServicesTab canManage={canManage} />;
    if (effectiveTab === 'chat' && access) return <ChatTab access={access} />;
    if (effectiveTab === 'media') return <MediaTab canManage={canManage} />;
    if (effectiveTab === 'config' && canManage) return <ConfigTab canManage={canManage} />;
    return <OverviewTab canManage={canManage} />;
  }, [effectiveTab, canManage, access]);

  if (authLoading || accessState === 'loading' || accessState === 'idle') {
    return (
      <main className="ui-page min-h-screen">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
          <LoadingCard label="Preparazione gestionale..." />
        </div>
      </main>
    );
  }

  if (!user) return null;

  if (accessState === 'error' || !access) {
    return (
      <main className="ui-page min-h-screen">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h1 className="ui-title">Accesso negato</h1>
              <p className="ui-body">{error ?? 'Il tuo account non ha accesso al gestionale.'}</p>
              <Button onClick={() => router.push('/services')}>Torna all’app</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-4 space-y-4">
        <Card className="admin-heroCard md:sticky md:top-0 md:z-40">
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="ui-accentPill w-fit">Gestionale</div>
                  <span className="ui-accentPill">{canManage ? 'Poteri completi' : 'Sola lettura'}</span>
                </div>
                <h1 className="ui-title">Tenuta del Barone Backoffice</h1>
              </div>
              <div className="admin-inlineControls admin-inlineControls--heroActions">
                {canManage ? <AdminNotificationBell /> : null}
                <Button variant="secondary" onClick={() => router.push('/services')}>
                  Torna all&apos;app
                </Button>
              </div>
            </div>

            <div className="admin-tabBar">
              {visibleTabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cx('admin-tabButton', effectiveTab === item.key && 'admin-tabButton--active')}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {tabContent}
      </div>
    </main>
  );
}
