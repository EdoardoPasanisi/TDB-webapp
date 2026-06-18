'use client';

import { useEffect, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type { AdminAgendaItem, AdminOverview } from '@/lib/admin/types';
import type { BookingStatus } from '@/types/booking';
import type { ServiceStatus } from '@/types/services';
import {
  Card,
  CardContent,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  EmptyCard,
  ErrorCard,
  LoadingCard,
  MetricCard,
  TimelineCard,
  type LoadState,
} from '@/components/admin/shared';
import { BookingDetailModal, UserDetailModal } from '@/components/admin/modals';
import { DocumentCard } from '@/components/admin/shared';

export function OverviewTab({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminAgendaItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const load = async () => {
    setState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<AdminOverview>('/api/admin/overview');
      setOverview(data);
      setState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare la situazione attuale.'));
      setState('error');
    }
  };

  const handleBookingStatus = async (item: AdminAgendaItem, status: BookingStatus | ServiceStatus) => {
    const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
    await fetchAdminJson(`/api/admin/bookings/${kind}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const handleDocumentDecision = async (documentId: string, status: 'ACCEPTED' | 'REJECTED') => {
    await fetchAdminJson(`/api/admin/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchAdminJson<AdminOverview>('/api/admin/overview', { signal: controller.signal })
      .then((data) => {
        setOverview(data);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare la situazione attuale.'));
        setState('error');
      });

    return () => {
      controller.abort();
    };
  }, []);

  if (state === 'loading' || state === 'idle') return <LoadingCard label="Caricamento overview..." />;
  if (state === 'error' || !overview) return <ErrorCard error={error ?? 'Errore overview.'} onRetry={load} />;

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            className="ui-btnCompact"
            onClick={() => window.open('/admin/print/pensione', '_blank', 'noopener')}
          >
            Stampa prenotazioni non stampate
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <MetricCard label="Check-in oggi" value={overview.totals.checkInsToday} tone="primary" />
        <MetricCard label="Check-out oggi" value={overview.totals.checkOutsToday} tone="primary" />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Richieste in attesa" value={overview.totals.pendingBookings} />
        <MetricCard label="Servizi oggi" value={overview.totals.servicesToday} />
        <MetricCard label="Cani presenti" value={overview.totals.presentDogs} />
        <MetricCard label="Pensioni in corso" value={overview.totals.activePensione} />
      </div>

      <Card className="admin-overviewCard--services">
        <CardContent className="space-y-3">
          <SectionHeader
            title="Servizi da fare oggi"
            subtitle="Vista operativa della giornata: attività effettive da eseguire adesso."
          />
          {overview.serviceCountsToday.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {overview.serviceCountsToday.map((entry) => (
                <MetricCard key={entry.serviceKey} label={entry.label} value={entry.count} />
              ))}
            </div>
          ) : (
            <EmptyCard label="Nessun servizio operativo previsto per oggi." />
          )}
          {overview.todayServices.length ? (
            <div className="space-y-3">
              {overview.todayServices.map((item) => (
                <TimelineCard
                  key={item.itemKey}
                  item={item}
                  canManage={canManage}
                  layout="service"
                  onOpenDetail={() => setSelectedBooking(item)}
                  onStatusChange={(status) => handleBookingStatus(item, status)}
                />
              ))}
            </div>
          ) : (
            <EmptyCard label="Nessun servizio da eseguire oggi." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="admin-overviewCard--pending">
          <CardContent className="space-y-3">
            <SectionHeader title="Richieste da gestire" subtitle="Prenotazioni in attesa di conferma, ordinate per priorità." />
            {overview.pendingBookings.length ? (
              <div className="space-y-3">
                {overview.pendingBookings.map((item) => (
                  <TimelineCard
                    key={item.itemKey}
                    item={item}
                    canManage={canManage}
                    onOpenDetail={() => setSelectedBooking(item)}
                    onStatusChange={(status) => handleBookingStatus(item, status)}
                  />
                ))}
              </div>
            ) : (
              <EmptyCard label="Nessuna richiesta in attesa." />
            )}
          </CardContent>
        </Card>

        <Card className="admin-overviewCard--documents">
          <CardContent className="space-y-3">
            <SectionHeader
              title="Documenti da verificare"
              subtitle={canManage ? 'Puoi controllare e decidere direttamente da qui.' : undefined}
            />
            {!canManage ? (
              <EmptyCard label="Documenti disponibili solo per account con poteri completi." />
            ) : overview.pendingDocuments.length ? (
              <div className="space-y-3">
                {overview.pendingDocuments.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    canManage={canManage}
                    onDecision={(status) => handleDocumentDecision(document.id, status)}
                    onOpenOwner={(userId) => setSelectedUserId(userId)}
                  />
                ))}
              </div>
            ) : (
              <EmptyCard label="Nessun documento in attesa." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="admin-overviewCard--upcoming">
        <CardContent className="space-y-3">
          <SectionHeader
            title="In corso e prossimi 7 giorni"
            subtitle="Prima le attività già in corso o di oggi, poi quelle più vicine nel tempo."
          />
          {overview.urgentItems.length ? (
            <div className="space-y-3">
              {overview.urgentItems.map((item) => (
                <TimelineCard
                  key={item.itemKey}
                  item={item}
                  canManage={canManage}
                  onOpenDetail={() => setSelectedBooking(item)}
                  onStatusChange={(status) => handleBookingStatus(item, status)}
                />
              ))}
            </div>
          ) : (
            <EmptyCard label="Nessuna attività operativa nei prossimi giorni." />
          )}
        </CardContent>
      </Card>

      <BookingDetailModal
        key={selectedBooking ? `${selectedBooking.kind}-${selectedBooking.id}` : 'overview-booking-detail-empty'}
        item={selectedBooking}
        open={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
      />
      <UserDetailModal
        key={selectedUserId ?? 'overview-user-detail-empty'}
        userId={selectedUserId}
        open={Boolean(selectedUserId)}
        onClose={() => setSelectedUserId(null)}
        canManage={canManage}
      />
    </div>
  );
}
