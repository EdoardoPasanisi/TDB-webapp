'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { fetchAdminJson } from '@/lib/admin/client';
import type { AdminStaffAccess } from '@/lib/admin/types';

function SettingActionCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="ui-selectCard">
      <div className="space-y-1 text-left">
        <div className="ui-body font-[var(--font-weight-semibold)]">{title}</div>
        <div className="ui-muted">{subtitle}</div>
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [staffAccess, setStaffAccess] = useState<AdminStaffAccess | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStaffAccess() {
      try {
        const data = await fetchAdminJson<AdminStaffAccess>('/api/admin/me');
        if (!cancelled) setStaffAccess(data);
      } catch {
        if (!cancelled) setStaffAccess(null);
      }
    }

    void loadStaffAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('sb-access-token');
          localStorage.removeItem('sb-refresh-token');
        } catch {}
      }
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 space-y-4">
        <header className="space-y-1">
          <h1 className="ui-title">Impostazioni</h1>
          <p className="ui-muted">Gestisci account, documenti e preferenze principali.</p>
        </header>

        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Account" />

            <div className="space-y-2">
              <SettingActionCard
                title="Dati e documenti"
                subtitle="Documento identità, liberatoria e dati personali."
                onClick={() => router.push('/account')}
              />

              <SettingActionCard
                title="Modifica password"
                subtitle="Aggiorna la password del tuo account."
                onClick={() => router.push('/account/password')}
              />
            </div>
          </CardContent>
        </Card>

        {staffAccess ? (
          <Card>
            <CardContent className="space-y-3">
              <SectionHeader
                title="Gestionale"
                subtitle={
                  staffAccess.canManage
                    ? 'Accesso completo al backoffice.'
                    : 'Accesso in sola lettura al backoffice.'
                }
              />

              <SettingActionCard
                title="Apri gestionale"
                subtitle="Clienti, cani, prenotazioni, documenti, slot e configurazione."
                onClick={() => router.push('/admin')}
              />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Legale" />

            <div className="grid grid-cols-1 gap-2">
              <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/privacy')}>
                Privacy
              </Button>
              <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/terms')}>
                Termini
              </Button>
              <Button type="button" variant="secondary" fullWidth onClick={() => router.push('/cookies')}>
                Cookie
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Sessione" subtitle="Gestisci l’accesso al tuo account." />

            <Button type="button" variant="primary" fullWidth disabled={logoutLoading} onClick={handleLogout}>
              {logoutLoading ? 'Uscita…' : 'Esci dall’account'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
