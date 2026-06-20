'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type {
  AdminAgendaItem,
  AdminServiceKey,
  AdminUserDetail,
  AdminUserListItem,
} from '@/lib/admin/types';
import { getAdminRoleLabel, getAdminServiceLabel } from '@/lib/admin/utils';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import type { Dog } from '@/types/dog';
import type { Profile } from '@/types/profile';
import type { BookingStatus } from '@/types/booking';
import type { ServiceStatus } from '@/types/services';
import { ProfileDetails } from '@/components/profile/ProfileDetails';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  EMPTY_PROFILE_FORM,
  SEARCH_DEBOUNCE_MS,
  buildProfilePayload,
  cx,
  formatDateTime,
  initProfileForm,
  EmptyCard,
  ErrorCard,
  LoadingCard,
  TimelineCard,
  buildRequiredDogMissing,
} from '@/components/admin/shared';
import { BookingDetailModal, DogDetailModal } from '@/components/admin/modals';
import { DocumentCard } from '@/components/admin/shared';
import { CreateUserModal } from '@/components/admin/CreateUserModal';
import { DogEditModal } from '@/components/admin/DogEditModal';
import { AssignPassModal } from '@/components/admin/AssignPassModal';
import { useConfirm } from '@/components/admin/ConfirmProvider';
import { Modal } from '@/components/common/Modal';

type UsersMode = 'all' | 'active' | 'deleted';

const MODE_TABS: Array<{ key: UsersMode; label: string }> = [
  { key: 'all', label: 'Tutti' },
  { key: 'active', label: 'Prenotazioni attive' },
  { key: 'deleted', label: 'Eliminati' },
];

function formatServicePassStatusLabel(status: string): string {
  if (status === 'LOCKED') return 'Da sbloccare';
  if (status === 'ACTIVE') return 'Attivo';
  if (status === 'CONSUMED') return 'Consumato';
  if (status === 'EXPIRED') return 'Scaduto';
  if (status === 'CANCELLED') return 'Annullato';
  return status;
}

export function UsersTab({ canManage }: { canManage: boolean }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [mode, setMode] = useState<UsersMode>('all');
  const [listState, setListState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE_FORM);
  const [profileEditing, setProfileEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [editingDog, setEditingDog] = useState<Dog | null>(null);
  const [addingDog, setAddingDog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminAgendaItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [userActionBusy, setUserActionBusy] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const confirm = useConfirm();

  const isDeletedMode = mode === 'deleted';
  const walletDue = Number(
    (detail?.profile as { wallet_due_eur?: number | null } | null)?.wallet_due_eur ?? 0
  );

  const buildListUrl = () =>
    isDeletedMode
      ? '/api/admin/users?status=deleted'
      : `/api/admin/users?q=${encodeURIComponent(debouncedQuery)}`;

  const applyMode = (list: AdminUserListItem[]) =>
    mode === 'active' ? list.filter((item) => item.activeBookings > 0) : list;

  const loadUsers = async () => {
    setListState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<{ items: AdminUserListItem[] }>(buildListUrl());
      const next = applyMode(data.items);
      setItems(next);
      setSelectedUserId((current) =>
        current && next.some((item) => item.userId === current) ? current : next[0]?.userId ?? null
      );
      setListState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare l’elenco dei clienti.'));
      setListState('error');
    }
  };

  const loadDetail = async (userId: string) => {
    setDetailState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<AdminUserDetail>(`/api/admin/users/${userId}`);
      setDetail(data);
      setProfileForm(initProfileForm(data.profile));
      setProfileEditing(false);
      setDetailState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio del cliente.'));
      setDetailState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setListState('loading');
    setError(null);

    fetchAdminJson<{ items: AdminUserListItem[] }>(buildListUrl(), { signal: controller.signal })
      .then((data) => {
        const next = mode === 'active' ? data.items.filter((item) => item.activeBookings > 0) : data.items;
        setItems(next);
        setSelectedUserId((current) =>
          current && next.some((item) => item.userId === current) ? current : next[0]?.userId ?? null
        );
        setListState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare l’elenco dei clienti.'));
        setListState('error');
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, mode]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      setDetailState('idle');
      return;
    }

    const controller = new AbortController();
    setDetailState('loading');
    setError(null);

    fetchAdminJson<AdminUserDetail>(`/api/admin/users/${selectedUserId}`, { signal: controller.signal })
      .then((data) => {
        setDetail(data);
        setProfileForm(initProfileForm(data.profile));
        setProfileEditing(false);
        setDetailState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il dettaglio del cliente.'));
        setDetailState('error');
      });

    return () => controller.abort();
  }, [selectedUserId]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) return;
    setSavingProfile(true);
    setError(null);
    try {
      const nextProfile = await fetchAdminJson<Profile>(`/api/admin/users/${selectedUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(buildProfilePayload(profileForm, detail?.profile ?? null)),
      });
      setDetail((current) => (current ? { ...current, profile: nextProfile } : current));
      setProfileForm(initProfileForm(nextProfile));
      setProfileEditing(false);
      await loadUsers();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare il profilo del cliente.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDocumentDecision = async (documentId: string, status: 'ACCEPTED' | 'REJECTED') => {
    await fetchAdminJson(`/api/admin/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (selectedUserId) await loadDetail(selectedUserId);
  };

  const handleDocumentReRequest = async (documentId: string) => {
    await fetchAdminJson(`/api/admin/documents/${documentId}/request-reupload`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (selectedUserId) await loadDetail(selectedUserId);
  };

  const handleDocumentUpload = async (documentId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/admin/documents/${documentId}/upload`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      body: formData,
    });
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(json?.error?.trim() || 'Non siamo riusciti a caricare il documento.');
    }
    if (selectedUserId) await loadDetail(selectedUserId);
  };

  const handleBookingStatus = async (item: AdminAgendaItem, status: BookingStatus | ServiceStatus) => {
    const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
    await fetchAdminJson(`/api/admin/bookings/${kind}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (selectedUserId) await loadDetail(selectedUserId);
  };

  const handleUnlockServicePass = async (passId: string) => {
    if (!selectedUserId) return;
    await fetchAdminJson(`/api/admin/users/${selectedUserId}/passes/${passId}/unlock`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    await loadDetail(selectedUserId);
  };

  const handleRemoveServicePass = async (passId: string) => {
    if (!selectedUserId) return;
    const ok = await confirm({
      keyword: 'ELIMINA',
      title: 'Annulla pacchetto',
      message: 'Il pacchetto/credito del cliente verrà annullato.',
    });
    if (!ok) return;
    await fetchAdminJson(`/api/admin/users/${selectedUserId}/passes/${passId}`, { method: 'DELETE' });
    await loadDetail(selectedUserId);
  };

  const handleSoftDeleteUser = async () => {
    if (!selectedUserId) return;
    const ok = await confirm({
      keyword: 'ELIMINA',
      title: 'Elimina cliente',
      message: 'Il cliente verrà spostato tra gli eliminati: non potrà più accedere. Cani e storico restano consultabili.',
    });
    if (!ok) return;
    setUserActionBusy(true);
    try {
      await fetchAdminJson(`/api/admin/users/${selectedUserId}`, { method: 'DELETE' });
      setSelectedUserId(null);
      await loadUsers();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare il cliente.'));
    } finally {
      setUserActionBusy(false);
    }
  };

  const handleRestoreUser = async () => {
    if (!selectedUserId) return;
    setUserActionBusy(true);
    try {
      await fetchAdminJson(`/api/admin/users/${selectedUserId}/restore`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSelectedUserId(null);
      await loadUsers();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a ripristinare il cliente.'));
    } finally {
      setUserActionBusy(false);
    }
  };

  const handleHardDeleteUser = async () => {
    if (!selectedUserId) return;
    const ok = await confirm({
      keyword: 'ELIMINA',
      title: 'Eliminazione definitiva',
      message: 'Account, cani, prenotazioni e documenti verranno cancellati in modo irreversibile.',
      confirmLabel: 'Elimina definitivamente',
    });
    if (!ok) return;
    setUserActionBusy(true);
    try {
      await fetchAdminJson(`/api/admin/users/${selectedUserId}/hard-delete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSelectedUserId(null);
      await loadUsers();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare definitivamente il cliente.'));
    } finally {
      setUserActionBusy(false);
    }
  };

  const openSettle = () => {
    setSettleError(null);
    setSettleAmount(walletDue > 0 ? walletDue.toFixed(2) : '0');
    setSettleOpen(true);
  };

  const handleSettleWallet = async () => {
    if (!selectedUserId) return;
    const amount = Number(String(settleAmount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) {
      setSettleError('Inserisci un importo valido.');
      return;
    }
    setSettleSubmitting(true);
    setSettleError(null);
    try {
      await fetchAdminJson(`/api/admin/users/${selectedUserId}/settle`, {
        method: 'POST',
        body: JSON.stringify({ amountEur: amount }),
      });
      setSettleOpen(false);
      await loadDetail(selectedUserId);
    } catch (err) {
      setSettleError(humanizeErrorMessage(err, 'Impossibile registrare il pagamento.'));
    } finally {
      setSettleSubmitting(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <SectionHeader title="Clienti" subtitle="Elenco in ordine alfabetico. Cerca per nome, email, telefono, città, CF o dati cane." />
              {canManage ? (
                <Button variant="primary" className="ui-btnCompact shrink-0" onClick={() => setCreateOpen(true)}>
                  Nuovo
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {MODE_TABS.map((tab) => {
                if (tab.key === 'deleted' && !canManage) return null;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMode(tab.key)}
                    className={cx('rounded-full px-3 py-1.5 ui-body ui-clickable', mode === tab.key && 'ui-clickable--selected')}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {!isDeletedMode ? (
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="ui-control ui-input"
                placeholder="Cerca utenti e cani..."
              />
            ) : null}
          </CardContent>
        </Card>

        {listState === 'loading' ? <LoadingCard label="Caricamento clienti..." /> : null}
        {listState === 'error' ? <ErrorCard error={error ?? 'Errore clienti.'} onRetry={loadUsers} /> : null}
        {listState === 'ready' && items.length === 0 ? (
          <EmptyCard
            label={
              isDeletedMode
                ? 'Nessun cliente eliminato.'
                : mode === 'active'
                  ? 'Nessun cliente con prenotazioni attive.'
                  : 'Nessun cliente trovato.'
            }
          />
        ) : null}

        {items.map((item) => (
          <button
            key={item.userId}
            type="button"
            onClick={() => setSelectedUserId(item.userId)}
            className={cx('min-w-0 w-full text-left', selectedUserId === item.userId && 'admin-selectedCard')}
          >
            <Card className="admin-listCard overflow-hidden">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="ui-body font-[var(--font-weight-semibold)] truncate">{item.fullName}</div>
                    <div className="ui-muted truncate">
                      {canManage
                        ? item.email ?? (item.dogNames.length ? item.dogNames.join(', ') : 'Nessun dato aggiuntivo')
                        : item.dogNames.length
                          ? item.dogNames.join(', ')
                          : 'Nessun cane registrato'}
                    </div>
                  </div>
                  {item.staffRole ? <span className="ui-accentPill">{item.staffRole}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ui-accentPill">{item.dogsCount} cani</span>
                  {canManage && !isDeletedMode ? <span className="ui-accentPill">{item.activeBookings} attive</span> : null}
                  {canManage && item.pendingDocuments > 0 ? (
                    <span className="ui-accentPill">{item.pendingDocuments} documenti</span>
                  ) : null}
                  {item.walletDue > 0 ? (
                    <span className="ui-accentPill ui-accentPill--saldo">Saldo € {item.walletDue.toFixed(2)}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-4">
        {error ? <div className="ui-error">{error}</div> : null}
        {detailState === 'loading' ? (
          <LoadingCard label="Caricamento dettaglio utente..." />
        ) : detailState === 'error' || !detail ? (
          <EmptyCard
            label={
              canManage
                ? 'Seleziona un cliente per vedere saldo, dati, cani, prenotazioni e documenti.'
                : 'Seleziona un cliente per vedere nome, cognome e cani collegati.'
            }
          />
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <h2 className="ui-title">
                      {detail.profile?.first_name || detail.profile?.last_name
                        ? `${detail.profile?.first_name ?? ''} ${detail.profile?.last_name ?? ''}`.trim()
                        : 'Cliente'}
                    </h2>
                    {canManage && detail.profile?.email ? <div className="ui-muted">{detail.profile.email}</div> : null}
                    <div className="flex flex-wrap gap-2">
                      <span className="ui-accentPill">{detail.dogs.length} cani</span>
                      {canManage ? <span className="ui-accentPill">{detail.activeTimeline.length} prenotazioni attive</span> : null}
                      {canManage ? <span className="ui-accentPill">{detail.historyTimeline.length} storico</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {detail.staffRole ? <span className="ui-accentPill">{getAdminRoleLabel(detail.staffRole)}</span> : null}
                    {canManage && isDeletedMode ? (
                      <>
                        <Button variant="secondary" className="ui-btnCompact" disabled={userActionBusy} onClick={() => void handleRestoreUser()}>
                          Ripristina
                        </Button>
                        <Button variant="danger" className="ui-btnCompact" disabled={userActionBusy} onClick={() => void handleHardDeleteUser()}>
                          Elimina definitivamente
                        </Button>
                      </>
                    ) : null}
                    {canManage && !isDeletedMode ? (
                      <Button variant="danger" className="ui-btnCompact" disabled={userActionBusy} onClick={() => void handleSoftDeleteUser()}>
                        Elimina cliente
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader
                  title="Saldo e pagamenti"
                  subtitle={
                    canManage
                      ? "Conferma l'incasso per azzerare il saldo e sbloccare i pacchetti."
                      : 'Saldo dovuto dal cliente (sola lettura).'
                  }
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="ui-body">
                    Saldo attuale: <span className="font-[var(--font-weight-bold)]">€ {walletDue.toFixed(2)}</span>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className="ui-btn ui-btnTone-primary ui-btnCompact"
                      disabled={walletDue <= 0}
                      onClick={openSettle}
                    >
                      Segna come pagato
                    </button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Dati da completare" subtitle="Informazioni obbligatorie mancanti per le prenotazioni." />
                {detail.ownerMissing.length ? (
                  <div className="ui-body">{detail.ownerMissing.join(', ')}</div>
                ) : (
                  <div className="ui-muted">Nessun dato obbligatorio mancante per il cliente.</div>
                )}
              </CardContent>
            </Card>

            {canManage ? (
              <ProfileDetails
                userEmail={detail.profile?.email ?? ''}
                profile={detail.profile}
                profileEditing={profileEditing}
                profileForm={profileForm}
                savingProfile={savingProfile}
                canEdit={canManage}
                onChangeText={(field, value) =>
                  setProfileForm((current) => {
                    const next = { ...current, [field]: value };
                    if (current.dog_address_same_as_home) {
                      if (field === 'address_line') next.dog_address_line = value;
                      if (field === 'city') next.dog_city = value;
                      if (field === 'zip_code') next.dog_zip_code = value;
                      if (field === 'province') next.dog_province = value;
                    }
                    return next;
                  })
                }
                onToggle={(field, value) =>
                  setProfileForm((current) => {
                    const next = { ...current, [field]: value };
                    if (field === 'dog_address_same_as_home' && value) {
                      next.dog_address_line = current.address_line;
                      next.dog_city = current.city;
                      next.dog_zip_code = current.zip_code;
                      next.dog_province = current.province;
                    }
                    return next;
                  })
                }
                onSubmit={saveProfile}
                onStartEdit={async () => {
                  const ok = await confirm({
                    keyword: 'MODIFICA',
                    title: 'Modifica informazioni cliente',
                    message: 'Stai per modificare i dati anagrafici e di contatto del cliente.',
                  });
                  if (ok) setProfileEditing(true);
                }}
                onCancelEdit={() => {
                  setProfileEditing(false);
                  setProfileForm(initProfileForm(detail.profile));
                }}
              />
            ) : null}

            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <SectionHeader title="Pet registrati" subtitle="Pet (cani, gatti, altro) collegati a questo cliente." />
                  {canManage ? (
                    <Button variant="secondary" className="ui-btnCompact shrink-0" onClick={() => setAddingDog(true)}>
                      Aggiungi pet
                    </Button>
                  ) : null}
                </div>
                {detail.dogs.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {detail.dogs.map((dog) => (
                      <Card key={dog.id} className="admin-listCard">
                        <CardContent className="space-y-1">
                          <button type="button" className="w-full text-left" onClick={() => setSelectedDogId(dog.id)}>
                            <div className="ui-body font-[var(--font-weight-semibold)] underline-offset-2 hover:underline">{dog.name}</div>
                            <div className="ui-muted">{dog.breed ?? 'Razza non specificata'}</div>
                            <div className="ui-muted">Microchip: {dog.microchip ?? '—'}</div>
                          </button>
                          {buildRequiredDogMissing(dog).length ? (
                            <div className="ui-muted">Dati mancanti: {buildRequiredDogMissing(dog).join(', ')}</div>
                          ) : null}
                          {canManage ? (
                            <div className="pt-1">
                              <Button
                                variant="secondary"
                                className="ui-btnCompact"
                                onClick={async () => {
                                  const ok = await confirm({
                                    keyword: 'MODIFICA',
                                    title: `Modifica ${dog.name}`,
                                    message: 'Stai per modificare i dati di questo cane.',
                                  });
                                  if (ok) setEditingDog(dog);
                                }}
                              >
                                Modifica pet
                              </Button>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Nessun pet registrato." />
                )}
              </CardContent>
            </Card>

            {canManage ? (
              <>
                <Card>
                  <CardContent className="space-y-3">
                    <SectionHeader title="Documenti" subtitle="Stato verifiche documento e liberatoria." />
                    {detail.documents.length ? (
                      <div className="space-y-3">
                        {detail.documents.map((document) => (
                          <DocumentCard
                            key={document.id}
                            document={document}
                            canManage={canManage}
                            onDecision={(status) => handleDocumentDecision(document.id, status)}
                            onReRequest={() => handleDocumentReRequest(document.id)}
                            onUpload={(file) => handleDocumentUpload(document.id, file)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyCard label="Nessun documento caricato." />
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}

            <Card>
              <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <SectionHeader title="Pacchetti e crediti" subtitle="Pass attivi, consumati o scaduti collegati al cliente." />
                      {canManage ? (
                        <Button variant="secondary" className="ui-btnCompact shrink-0" onClick={() => setAssignOpen(true)}>
                          Assegna pacchetto
                        </Button>
                      ) : null}
                    </div>
                    {detail.servicePasses.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {detail.servicePasses.map((servicePass) => (
                          <Card key={servicePass.id} className="admin-listCard">
                            <CardContent className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="ui-body font-[var(--font-weight-semibold)]">
                                    {getAdminServiceLabel(
                                      servicePass.service_type as AdminServiceKey,
                                      servicePass.service_type,
                                      servicePass.service_variant
                                    )}
                                  </div>
                                  <div className="ui-muted">Acquistato il {formatDateTime(servicePass.purchased_at)}</div>
                                </div>
                                <span className="ui-accentPill">{formatServicePassStatusLabel(servicePass.status)}</span>
                              </div>
                              <div className="ui-body">
                                Crediti: {servicePass.credits_total - servicePass.credits_used}/{servicePass.credits_total}
                              </div>
                              {servicePass.expires_at ? (
                                <div className="ui-muted">Scadenza: {formatDateTime(servicePass.expires_at)}</div>
                              ) : null}
                              {servicePass.status === 'LOCKED' ? (
                                <div className="ui-muted">Pagamento registrato ma pacchetto non ancora sbloccato.</div>
                              ) : null}
                              {servicePass.unlocked_at ? (
                                <div className="ui-muted">Sbloccato il {formatDateTime(servicePass.unlocked_at)}</div>
                              ) : null}
                              {canManage ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {servicePass.status === 'LOCKED' ? (
                                    <Button
                                      variant="secondary"
                                      className="ui-btnCompact"
                                      onClick={() => void handleUnlockServicePass(servicePass.id)}
                                    >
                                      Sblocca utilizzo
                                    </Button>
                                  ) : null}
                                  {servicePass.status !== 'CANCELLED' ? (
                                    <Button
                                      variant="danger"
                                      className="ui-btnCompact"
                                      onClick={() => void handleRemoveServicePass(servicePass.id)}
                                    >
                                      Annulla
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <EmptyCard label="Nessun pacchetto o credito associato." />
                    )}
              </CardContent>
            </Card>

            {canManage ? (
              <>
                <Card>
                  <CardContent className="space-y-3">
                    <SectionHeader title="Prenotazioni attive" subtitle="Tutte le prenotazioni correnti e future del cliente." />
                    {detail.activeTimeline.length ? (
                      <div className="space-y-3">
                        {detail.activeTimeline.map((item) => (
                          <TimelineCard
                            key={item.itemKey}
                            item={item}
                            canManage={canManage}
                            showUser={false}
                            onOpenDetail={() => setSelectedBooking(item)}
                            onStatusChange={(status) => handleBookingStatus(item, status)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyCard label="Nessuna prenotazione attiva." />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3">
                    <SectionHeader title="Storico" subtitle="Prenotazioni già concluse o passate del cliente." />
                    {detail.historyTimeline.length ? (
                      <div className="space-y-3">
                        {detail.historyTimeline.map((item) => (
                          <TimelineCard
                            key={item.itemKey}
                            item={item}
                            canManage={false}
                            showUser={false}
                            onOpenDetail={() => setSelectedBooking(item)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyCard label="Storico vuoto." />
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}

            <DogDetailModal
              key={selectedDogId ?? 'users-dog-detail-empty'}
              dogId={selectedDogId}
              open={Boolean(selectedDogId)}
              onClose={() => setSelectedDogId(null)}
            />
            <DogEditModal
              key={editingDog ? `edit-${editingDog.id}` : 'users-dog-edit-empty'}
              open={Boolean(editingDog)}
              mode="edit"
              dog={editingDog}
              onClose={() => setEditingDog(null)}
              onSaved={() => {
                if (selectedUserId) void loadDetail(selectedUserId);
              }}
            />
            <DogEditModal
              open={addingDog}
              mode="create"
              ownerId={selectedUserId}
              onClose={() => setAddingDog(false)}
              onSaved={() => {
                if (selectedUserId) void loadDetail(selectedUserId);
              }}
            />
            <AssignPassModal
              open={assignOpen}
              userId={selectedUserId}
              onClose={() => setAssignOpen(false)}
              onAssigned={() => {
                if (selectedUserId) void loadDetail(selectedUserId);
              }}
            />
            <BookingDetailModal
              key={selectedBooking ? `${selectedBooking.kind}-${selectedBooking.id}` : 'users-booking-detail-empty'}
              item={selectedBooking}
              open={Boolean(selectedBooking)}
              onClose={() => setSelectedBooking(null)}
              canManage={canManage}
              onDeleted={() => {
                if (selectedUserId) void loadDetail(selectedUserId);
              }}
            />

            <Modal open={settleOpen} title="Conferma pagamento" onClose={() => setSettleOpen(false)}>
              <div className="space-y-4">
                <div className="ui-muted">
                  Saldo da pagare: <span className="font-[var(--font-weight-bold)]">€ {walletDue.toFixed(2)}</span>. Conferma
                  l&apos;importo effettivamente incassato (modificabile in caso di sconto). Il saldo verrà azzerato e i pacchetti
                  in attesa verranno sbloccati.
                </div>
                <div className="space-y-1">
                  <label className="ui-muted">Importo incassato (€)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={settleAmount}
                    onChange={(event) => setSettleAmount(event.target.value)}
                    className="ui-control ui-input"
                  />
                </div>
                {settleError ? <div className="ui-error">{settleError}</div> : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="ui-btn ui-btnTone-secondary ui-btnCompact"
                    onClick={() => setSettleOpen(false)}
                    disabled={settleSubmitting}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btnTone-primary ui-btnCompact"
                    onClick={() => void handleSettleWallet()}
                    disabled={settleSubmitting}
                  >
                    {settleSubmitting ? 'Salvataggio…' : 'Conferma pagamento'}
                  </button>
                </div>
              </div>
            </Modal>
          </>
        )}
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (userId) => {
          setMode('all');
          await loadUsers();
          setSelectedUserId(userId);
        }}
      />
    </div>
  );
}
