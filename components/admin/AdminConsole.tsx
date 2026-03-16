'use client';

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson } from '@/lib/admin/client';
import type {
  AdminAgendaItem,
  AdminDateViewResponse,
  AdminDocumentRecord,
  AdminDogDetail,
  AdminDogListItem,
  AdminOverview,
  AdminServiceKey,
  AdminSlotRecord,
  AdminStaffAccess,
  AdminStaffMember,
  AdminUserDetail,
  AdminUserListItem,
  StaffRole,
} from '@/lib/admin/types';
import {
  ADMIN_SERVICE_OPTIONS,
  getAdminRoleLabel,
  getAdminServiceLabel,
  getAdminStatusLabel,
  STAFF_ROLE_OPTIONS,
} from '@/lib/admin/utils';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import type { Profile } from '@/types/profile';
import type { ProfileFormState } from '@/types/forms';
import type { Dog, DogInput } from '@/types/dog';
import type { BookingStatus } from '@/types/booking';
import type { ServiceStatus, ServiceType, ServiceVariant } from '@/types/services';
import { isValidItalianFiscalCode, sanitizeFiscalCode } from '@/lib/validation/italy';
import { ProfileDetails } from '@/components/profile/ProfileDetails';
import { DogForm } from '@/components/dogs/DogForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

type AdminTab = 'overview' | 'users' | 'dogs' | 'dates' | 'services' | 'config';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const ADMIN_TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Utenti' },
  { key: 'dogs', label: 'Cani' },
  { key: 'dates', label: 'Date' },
  { key: 'services', label: 'Servizi' },
  { key: 'config', label: 'Config' },
];

const EMPTY_PROFILE_FORM: ProfileFormState = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  address_line: '',
  city: '',
  zip_code: '',
  province: '',
  fiscal_code: '',
  birth_date: '',
  dog_address_same_as_home: true,
  dog_address_line: '',
  dog_city: '',
  dog_zip_code: '',
  dog_province: '',
  show_first_name_on_dog_card: true,
  show_last_name_on_dog_card: true,
  show_phone_on_dog_card: true,
  show_email_on_dog_card: false,
  show_address_on_dog_card: false,
  show_dog_address_on_dog_card: false,
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value.split('-').reverse().join('/');
    }
    return value;
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: value.includes('T') ? '2-digit' : undefined,
    minute: value.includes('T') ? '2-digit' : undefined,
  }).format(date);
}

function formatEuro(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

function coalesceBool(value: boolean | null | undefined, fallback: boolean): boolean {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function inferDogAddressSameAsHome(row: Profile | null): boolean {
  if (!row) return true;

  const hasAnyDogAddress =
    !!row.dog_address_line || !!row.dog_city || !!row.dog_zip_code || !!row.dog_province;

  if (!hasAnyDogAddress) return true;

  const eq = (a: string | null, b: string | null) => (a ?? '').trim() === (b ?? '').trim();

  return (
    eq(row.dog_address_line, row.address_line) &&
    eq(row.dog_city, row.city) &&
    eq(row.dog_zip_code, row.zip_code) &&
    eq(row.dog_province, row.province)
  );
}

function initProfileForm(profile: Profile | null): ProfileFormState {
  const dogSame = inferDogAddressSameAsHome(profile);

  return {
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    address_line: profile?.address_line ?? '',
    city: profile?.city ?? '',
    zip_code: profile?.zip_code ?? '',
    province: profile?.province ?? '',
    fiscal_code: profile?.fiscal_code ?? '',
    birth_date: profile?.birth_date ?? '',
    dog_address_same_as_home: dogSame,
    dog_address_line: profile?.dog_address_line ?? (dogSame ? profile?.address_line ?? '' : ''),
    dog_city: profile?.dog_city ?? (dogSame ? profile?.city ?? '' : ''),
    dog_zip_code: profile?.dog_zip_code ?? (dogSame ? profile?.zip_code ?? '' : ''),
    dog_province: profile?.dog_province ?? (dogSame ? profile?.province ?? '' : ''),
    show_first_name_on_dog_card: coalesceBool(profile?.show_first_name_on_dog_card, true),
    show_last_name_on_dog_card: coalesceBool(profile?.show_last_name_on_dog_card, true),
    show_phone_on_dog_card: coalesceBool(profile?.show_phone_on_dog_card, true),
    show_email_on_dog_card: coalesceBool(profile?.show_email_on_dog_card, false),
    show_address_on_dog_card: coalesceBool(profile?.show_address_on_dog_card, false),
    show_dog_address_on_dog_card: coalesceBool(profile?.show_dog_address_on_dog_card, false),
  };
}

function buildProfilePayload(form: ProfileFormState, currentProfile: Profile | null): Partial<Profile> {
  const dogAddress = form.dog_address_same_as_home
    ? {
        dog_address_line: form.address_line || null,
        dog_city: form.city || null,
        dog_zip_code: form.zip_code || null,
        dog_province: form.province || null,
      }
    : {
        dog_address_line: form.dog_address_line || null,
        dog_city: form.dog_city || null,
        dog_zip_code: form.dog_zip_code || null,
        dog_province: form.dog_province || null,
      };

  const fiscalCode = sanitizeFiscalCode(form.fiscal_code);
  const shouldKeepOldFiscalCode =
    fiscalCode.length > 0 && !isValidItalianFiscalCode(fiscalCode);

  return {
    first_name: form.first_name || null,
    last_name: form.last_name || null,
    phone: form.phone || null,
    email: form.email || null,
    address_line: form.address_line || null,
    city: form.city || null,
    zip_code: form.zip_code || null,
    province: form.province || null,
    fiscal_code: fiscalCode.length === 0 ? null : shouldKeepOldFiscalCode ? currentProfile?.fiscal_code ?? null : fiscalCode,
    birth_date: form.birth_date || null,
    ...dogAddress,
    show_first_name_on_dog_card: form.show_first_name_on_dog_card,
    show_last_name_on_dog_card: form.show_last_name_on_dog_card,
    show_phone_on_dog_card: form.show_phone_on_dog_card,
    show_email_on_dog_card: form.show_email_on_dog_card,
    show_address_on_dog_card: form.show_address_on_dog_card,
    show_dog_address_on_dog_card: form.show_dog_address_on_dog_card,
  };
}

function nextStatuses(status: string | null | undefined): Array<BookingStatus | ServiceStatus> {
  if (status === 'PENDING') return ['CONFIRMED'];
  if (status === 'CONFIRMED') return ['PAID', 'COMPLETED'];
  if (status === 'PAID') return ['COMPLETED'];
  return [];
}

function statusTone(status: string | null | undefined) {
  if (status === 'PENDING') return 'admin-status admin-status--pending';
  if (status === 'CONFIRMED') return 'admin-status admin-status--confirmed';
  if (status === 'PAID') return 'admin-status admin-status--paid';
  if (status === 'COMPLETED') return 'admin-status admin-status--completed';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'admin-status admin-status--danger';
  if (status === 'ACCEPTED') return 'admin-status admin-status--accepted';
  return 'admin-status';
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="admin-metricCard">
      <CardContent className="space-y-1">
        <div className="ui-muted">{label}</div>
        <div className="admin-metricValue">{value}</div>
      </CardContent>
    </Card>
  );
}

function LoadingCard({ label = 'Caricamento...' }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="ui-spinner" />
        <div className="ui-muted">{label}</div>
      </CardContent>
    </Card>
  );
}

function ErrorCard({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="ui-error">{error}</div>
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Riprova
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="ui-muted">{label}</CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  return <span className={statusTone(status)}>{getAdminStatusLabel(status as BookingStatus | ServiceStatus | null)}</span>;
}

function TimelineCard({
  item,
  canManage,
  showUser = true,
  onStatusChange,
}: {
  item: AdminAgendaItem;
  canManage: boolean;
  showUser?: boolean;
  onStatusChange?: (nextStatus: BookingStatus | ServiceStatus) => Promise<void> | void;
}) {
  const actions = nextStatuses(item.status);

  return (
    <Card className="admin-listCard">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="ui-body font-[var(--font-weight-semibold)]">{item.serviceLabel}</div>
            {showUser ? <div className="ui-muted truncate">{item.userName}</div> : null}
          </div>
          <StatusBadge status={item.status} />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="ui-panelInset p-3">
            <div className="ui-muted">Quando</div>
            <div className="ui-body mt-1">
              {formatDateTime(item.startAt)}
              {item.endAt ? ` → ${formatDateTime(item.endAt)}` : ''}
            </div>
          </div>
          <div className="ui-panelInset p-3">
            <div className="ui-muted">Cani</div>
            <div className="ui-body mt-1">{item.dogNames.length ? item.dogNames.join(', ') : 'Nessun cane associato'}</div>
          </div>
        </div>

        {item.meta.length ? (
          <div className="flex flex-wrap gap-2">
            {item.meta.map((meta) => (
              <span key={`${item.id}-${meta}`} className="ui-accentPill">
                {meta}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="ui-muted">{formatEuro(item.totalPrice)}</div>
          {canManage && onStatusChange && actions.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2">
              {actions.map((status) => (
                <Button key={status} variant="secondary" className="ui-btnCompact" onClick={() => void onStatusChange(status)}>
                  {getAdminStatusLabel(status)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {item.notes ? (
          <div className="ui-panelInset p-3">
            <div className="ui-muted">Note</div>
            <div className="ui-body mt-1 whitespace-pre-line">{item.notes}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DocumentCard({
  document,
  canManage,
  onDecision,
}: {
  document: AdminDocumentRecord;
  canManage: boolean;
  onDecision?: (status: 'ACCEPTED' | 'REJECTED') => Promise<void> | void;
}) {
  return (
    <Card className="admin-listCard">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="ui-body font-[var(--font-weight-semibold)]">
              {document.kind === 'ID_DOCUMENT' ? 'Documento identità' : 'Liberatoria firmata'}
            </div>
            <div className="ui-muted">{document.fileName}</div>
          </div>
          <span className={statusTone(document.status)}>{document.status}</span>
        </div>

        <div className="ui-muted">Caricato il {formatDateTime(document.createdAt)}</div>

        <div className="flex flex-wrap gap-2">
          {document.signedUrl ? (
            <a href={document.signedUrl} target="_blank" rel="noreferrer" className="ui-btn ui-btnTone-secondary ui-btnCompact">
              Apri file
            </a>
          ) : null}
          {canManage && onDecision && document.status === 'PENDING' ? (
            <>
              <Button className="ui-btnCompact" onClick={() => void onDecision('ACCEPTED')}>
                Accetta
              </Button>
              <Button variant="danger" className="ui-btnCompact" onClick={() => void onDecision('REJECTED')}>
                Rifiuta
              </Button>
            </>
          ) : null}
        </div>

        {document.staffNote ? (
          <div className="ui-panelInset p-3">
            <div className="ui-muted">Nota staff</div>
            <div className="ui-body mt-1">{document.staffNote}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  const load = async () => {
    setState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<AdminOverview>('/api/admin/overview');
      setOverview(data);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore overview.');
      setState('error');
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchAdminJson<AdminOverview>('/api/admin/overview')
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore overview.');
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading' || state === 'idle') return <LoadingCard label="Caricamento overview..." />;
  if (state === 'error' || !overview) return <ErrorCard error={error ?? 'Errore overview.'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="Clienti" value={overview.totals.users} />
        <MetricCard label="Cani" value={overview.totals.dogs} />
        <MetricCard label="Attive" value={overview.totals.activeBookings} />
        <MetricCard label="In attesa" value={overview.totals.pendingBookings} />
        <MetricCard label="Documenti" value={overview.totals.pendingDocuments} />
      </div>

      <Card>
        <CardContent className="space-y-3">
          <SectionHeader title="Prenotazioni da gestire" subtitle="Le prossime richieste in attesa." />
          {overview.pendingBookings.length ? (
            <div className="space-y-3">
              {overview.pendingBookings.map((item) => (
                <TimelineCard key={`${item.kind}-${item.id}`} item={item} canManage={canManage} />
              ))}
            </div>
          ) : (
            <EmptyCard label="Nessuna prenotazione in attesa." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Documenti da verificare" />
            {overview.pendingDocuments.length ? (
              <div className="space-y-3">
                {overview.pendingDocuments.map((document) => (
                  <DocumentCard key={document.id} document={document} canManage={false} />
                ))}
              </div>
            ) : (
              <EmptyCard label="Nessun documento in attesa." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Agenda prossimi 14 giorni" />
            {overview.upcomingServices.length ? (
              <div className="space-y-3">
                {overview.upcomingServices.map((item) => (
                  <TimelineCard key={`${item.kind}-${item.id}`} item={item} canManage={false} />
                ))}
              </div>
            ) : (
              <EmptyCard label="Nessun servizio in agenda." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersTab({ canManage }: { canManage: boolean }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [listState, setListState] = useState<LoadState>('loading');
  const [detailState, setDetailState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [profileEditing, setProfileEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole | ''>('');

  const loadUsers = async () => {
    setListState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<{ items: AdminUserListItem[] }>(
        `/api/admin/users?q=${encodeURIComponent(deferredQuery)}`
      );
      setItems(data.items);
      setSelectedUserId((current) => (current && data.items.some((item) => item.userId === current) ? current : data.items[0]?.userId ?? null));
      setListState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore utenti.');
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
      setStaffRole((data.staffRole ?? '') as StaffRole | '');
      setDetailState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore dettaglio utente.');
      setDetailState('error');
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchAdminJson<{ items: AdminUserListItem[] }>(`/api/admin/users?q=${encodeURIComponent(deferredQuery)}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setSelectedUserId((current) =>
          current && data.items.some((item) => item.userId === current) ? current : data.items[0]?.userId ?? null
        );
        setListState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore utenti.');
        setListState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetail(null);
      return;
    }
    let cancelled = false;

    fetchAdminJson<AdminUserDetail>(`/api/admin/users/${selectedUserId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setProfileForm(initProfileForm(data.profile));
        setProfileEditing(false);
        setStaffRole((data.staffRole ?? '') as StaffRole | '');
        setDetailState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore dettaglio utente.');
        setDetailState('error');
      });

    return () => {
      cancelled = true;
    };
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
      setError(err instanceof Error ? err.message : 'Errore salvataggio profilo.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveRole = async () => {
    if (!selectedUserId) return;
    setSavingRole(true);
    setError(null);
    try {
      const response = await fetchAdminJson<{ role: StaffRole | null }>(`/api/admin/users/${selectedUserId}/staff`, {
        method: 'PUT',
        body: JSON.stringify({ role: staffRole || null }),
      });
      setDetail((current) => (current ? { ...current, staffRole: response.role } : current));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio ruolo.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDocumentDecision = async (documentId: string, status: 'ACCEPTED' | 'REJECTED') => {
    await fetchAdminJson(`/api/admin/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
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

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Ricerca clienti" subtitle="Cerca per nome, email, telefono, città, CF o dati cane." />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-control ui-input"
              placeholder="Cerca utenti e cani..."
            />
          </CardContent>
        </Card>

        {listState === 'loading' || listState === 'idle' ? <LoadingCard label="Caricamento clienti..." /> : null}
        {listState === 'error' ? <ErrorCard error={error ?? 'Errore clienti.'} onRetry={loadUsers} /> : null}
        {listState === 'ready' && items.length === 0 ? <EmptyCard label="Nessun cliente trovato." /> : null}

        {items.map((item) => (
          <button
            key={item.userId}
            type="button"
            onClick={() => setSelectedUserId(item.userId)}
            className={cx('w-full text-left', selectedUserId === item.userId && 'admin-selectedCard')}
          >
            <Card className="admin-listCard">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="ui-body font-[var(--font-weight-semibold)] truncate">{item.fullName}</div>
                    <div className="ui-muted truncate">{item.email ?? 'Email non impostata'}</div>
                  </div>
                  {item.staffRole ? <span className="ui-accentPill">{item.staffRole}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ui-accentPill">{item.dogsCount} cani</span>
                  <span className="ui-accentPill">{item.activeBookings} attive</span>
                  {item.pendingDocuments > 0 ? <span className="ui-accentPill">{item.pendingDocuments} documenti</span> : null}
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {error ? <div className="ui-error">{error}</div> : null}
        {detailState === 'loading' || detailState === 'idle' ? (
          <LoadingCard label="Caricamento dettaglio utente..." />
        ) : detailState === 'error' || !detail ? (
          <EmptyCard label="Seleziona un cliente per vedere dettaglio, cani, prenotazioni e documenti." />
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <h2 className="ui-title">{detail.profile?.first_name || detail.profile?.last_name ? `${detail.profile?.first_name ?? ''} ${detail.profile?.last_name ?? ''}`.trim() : 'Cliente'}</h2>
                    <div className="ui-muted">{detail.profile?.email ?? 'Email non impostata'}</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="ui-accentPill">{detail.dogs.length} cani</span>
                      <span className="ui-accentPill">{detail.activeTimeline.length} prenotazioni attive</span>
                      <span className="ui-accentPill">{detail.historyTimeline.length} storico</span>
                    </div>
                  </div>

                  <div className="admin-inlineControls">
                    <select
                      value={staffRole}
                      onChange={(event) => setStaffRole(event.target.value as StaffRole | '')}
                      className="ui-control ui-select"
                      disabled={!canManage || savingRole}
                    >
                      <option value="">Nessun accesso gestionale</option>
                      {STAFF_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {canManage ? (
                      <Button variant="secondary" className="ui-btnCompact" disabled={savingRole} onClick={saveRole}>
                        {savingRole ? 'Salvataggio...' : 'Salva ruolo'}
                      </Button>
                    ) : (
                      <span className="ui-accentPill">{getAdminRoleLabel(detail.staffRole)}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

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
              onStartEdit={() => setProfileEditing(true)}
              onCancelEdit={() => {
                setProfileEditing(false);
                setProfileForm(initProfileForm(detail.profile));
              }}
            />

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Cani registrati" subtitle="Profili cane collegati a questo cliente." />
                {detail.dogs.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {detail.dogs.map((dog) => (
                      <Card key={dog.id} className="admin-listCard">
                        <CardContent className="space-y-1">
                          <div className="ui-body font-[var(--font-weight-semibold)]">{dog.name}</div>
                          <div className="ui-muted">{dog.breed ?? 'Razza non specificata'}</div>
                          <div className="ui-muted">Microchip: {dog.microchip ?? '—'}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Nessun cane registrato." />
                )}
              </CardContent>
            </Card>

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
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Nessun documento caricato." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Pacchetti e crediti" subtitle="Pass attivi, consumati o scaduti collegati al cliente." />
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
                              <div className="ui-muted">
                                Acquistato il {formatDateTime(servicePass.purchased_at)}
                              </div>
                            </div>
                            <span className={statusTone(servicePass.status)}>{servicePass.status}</span>
                          </div>
                          <div className="ui-body">
                            Crediti: {servicePass.credits_total - servicePass.credits_used}/{servicePass.credits_total}
                          </div>
                          {servicePass.expires_at ? (
                            <div className="ui-muted">Scadenza: {formatDateTime(servicePass.expires_at)}</div>
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

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Prenotazioni attive" subtitle="Tutte le prenotazioni correnti e future del cliente." />
                {detail.activeTimeline.length ? (
                  <div className="space-y-3">
                    {detail.activeTimeline.map((item) => (
                      <TimelineCard
                        key={`${item.kind}-${item.id}`}
                        item={item}
                        canManage={canManage}
                        showUser={false}
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
                <SectionHeader title="Storico" subtitle="Prenotazioni concluse, annullate o passate." />
                {detail.historyTimeline.length ? (
                  <div className="space-y-3">
                    {detail.historyTimeline.map((item) => (
                      <TimelineCard key={`${item.kind}-${item.id}`} item={item} canManage={false} showUser={false} />
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Storico vuoto." />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function DogsTab({ canManage }: { canManage: boolean }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [listState, setListState] = useState<LoadState>('loading');
  const [detailState, setDetailState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminDogListItem[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDogDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingDog, setSavingDog] = useState(false);

  const loadDogs = async () => {
    setListState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<{ items: AdminDogListItem[] }>(
        `/api/admin/dogs?q=${encodeURIComponent(deferredQuery)}`
      );
      setItems(data.items);
      setSelectedDogId((current) => (current && data.items.some((item) => item.dogId === current) ? current : data.items[0]?.dogId ?? null));
      setListState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore cani.');
      setListState('error');
    }
  };

  const loadDetail = async (dogId: string) => {
    setDetailState('loading');
    setError(null);
    try {
      const data = await fetchAdminJson<AdminDogDetail>(`/api/admin/dogs/${dogId}`);
      setDetail(data);
      setEditing(false);
      setDetailState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore dettaglio cane.');
      setDetailState('error');
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchAdminJson<{ items: AdminDogListItem[] }>(`/api/admin/dogs?q=${encodeURIComponent(deferredQuery)}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setSelectedDogId((current) =>
          current && data.items.some((item) => item.dogId === current) ? current : data.items[0]?.dogId ?? null
        );
        setListState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore cani.');
        setListState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  useEffect(() => {
    if (!selectedDogId) {
      setDetail(null);
      return;
    }
    let cancelled = false;

    fetchAdminJson<AdminDogDetail>(`/api/admin/dogs/${selectedDogId}`)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setEditing(false);
        setDetailState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore dettaglio cane.');
        setDetailState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDogId]);

  const saveDog = async (input: DogInput) => {
    if (!selectedDogId) return;
    setSavingDog(true);
    setError(null);
    try {
      await fetchAdminJson<Dog>(`/api/admin/dogs/${selectedDogId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      await Promise.all([loadDogs(), loadDetail(selectedDogId)]);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio cane.');
    } finally {
      setSavingDog(false);
    }
  };

  const handleBookingStatus = async (item: AdminAgendaItem, status: BookingStatus | ServiceStatus) => {
    const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
    await fetchAdminJson(`/api/admin/bookings/${kind}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (selectedDogId) await loadDetail(selectedDogId);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Ricerca cani" subtitle="Cerca per nome, razza, microchip o dati del proprietario." />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-control ui-input"
              placeholder="Cerca cane..."
            />
          </CardContent>
        </Card>

        {listState === 'loading' || listState === 'idle' ? <LoadingCard label="Caricamento cani..." /> : null}
        {listState === 'error' ? <ErrorCard error={error ?? 'Errore cani.'} onRetry={loadDogs} /> : null}
        {listState === 'ready' && items.length === 0 ? <EmptyCard label="Nessun cane trovato." /> : null}

        {items.map((item) => (
          <button
            key={item.dogId}
            type="button"
            onClick={() => setSelectedDogId(item.dogId)}
            className={cx('w-full text-left', selectedDogId === item.dogId && 'admin-selectedCard')}
          >
            <Card className="admin-listCard">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="ui-body font-[var(--font-weight-semibold)] truncate">{item.name}</div>
                    <div className="ui-muted truncate">{item.ownerName}</div>
                  </div>
                  <span className="ui-accentPill">{item.activeBookings} attive</span>
                </div>
                <div className="ui-muted">{item.breed ?? 'Razza non specificata'}</div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {error ? <div className="ui-error">{error}</div> : null}
        {detailState === 'loading' || detailState === 'idle' ? (
          <LoadingCard label="Caricamento dettaglio cane..." />
        ) : detailState === 'error' || !detail ? (
          <EmptyCard label="Seleziona un cane per vedere proprietario, storico e prenotazioni." />
        ) : (
          <>
            <Card>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <h2 className="ui-title">{detail.dog.name}</h2>
                    <div className="ui-muted">{detail.owner?.first_name || detail.owner?.last_name ? `${detail.owner?.first_name ?? ''} ${detail.owner?.last_name ?? ''}`.trim() : 'Proprietario non compilato'}</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="ui-accentPill">{detail.dog.breed ?? 'Razza non specificata'}</span>
                      {detail.dog.microchip ? <span className="ui-accentPill">Microchip {detail.dog.microchip}</span> : null}
                      {detail.ownerStaffRole ? <span className="ui-accentPill">{detail.ownerStaffRole}</span> : null}
                    </div>
                  </div>
                  {canManage ? (
                    <Button variant="secondary" onClick={() => setEditing((current) => !current)}>
                      {editing ? 'Chiudi modifica' : 'Modifica cane'}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {editing && canManage ? (
              <Card>
                <CardContent>
                  <DogForm
                    mode="edit"
                    initialDog={detail.dog}
                    onSubmit={saveDog}
                    submitting={savingDog}
                    photoEnabled={false}
                    onCancel={() => setEditing(false)}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Prenotazioni attive" subtitle="Servizi correnti e futuri del cane." />
                {detail.activeTimeline.length ? (
                  <div className="space-y-3">
                    {detail.activeTimeline.map((item) => (
                      <TimelineCard
                        key={`${item.kind}-${item.id}`}
                        item={item}
                        canManage={canManage}
                        showUser={false}
                        onStatusChange={(status) => handleBookingStatus(item, status)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Nessuna prenotazione attiva per questo cane." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3">
                <SectionHeader title="Storico" subtitle="Cronologia servizi completati o passati del cane." />
                {detail.historyTimeline.length ? (
                  <div className="space-y-3">
                    {detail.historyTimeline.map((item) => (
                      <TimelineCard key={`${item.kind}-${item.id}`} item={item} canManage={false} showUser={false} />
                    ))}
                  </div>
                ) : (
                  <EmptyCard label="Storico cane vuoto." />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function DateTab({ canManage }: { canManage: boolean }) {
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(plusDaysIso(7));
  const [status, setStatus] = useState('ALL');
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminDateViewResponse | null>(null);

  const load = async () => {
    setState('loading');
    setError(null);
    try {
      const payload = await fetchAdminJson<AdminDateViewResponse>(
        `/api/admin/date?start=${startDate}&end=${endDate}&status=${status}`
      );
      setData(payload);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore vista date.');
      setState('error');
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchAdminJson<AdminDateViewResponse>(`/api/admin/date?start=${startDate}&end=${endDate}&status=${status}`)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore vista date.');
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, status]);

  const handleBookingStatus = async (item: AdminAgendaItem, nextStatus: BookingStatus | ServiceStatus) => {
    const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
    await fetchAdminJson(`/api/admin/bookings/${kind}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="ui-label">Dal</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="ui-control ui-input" />
          </div>
          <div className="space-y-1">
            <label className="ui-label">Al</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="ui-control ui-input" />
          </div>
          <div className="space-y-1">
            <label className="ui-label">Stato</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="ui-control ui-select">
              <option value="ALL">Tutti</option>
              <option value="PENDING">In attesa</option>
              <option value="CONFIRMED">Confermate</option>
              <option value="PAID">Pagate</option>
              <option value="COMPLETED">Completate</option>
              <option value="CANCELLED">Annullate</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button fullWidth variant="secondary" onClick={load}>
              Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      {state === 'loading' || state === 'idle' ? <LoadingCard label="Caricamento agenda..." /> : null}
      {state === 'error' ? <ErrorCard error={error ?? 'Errore agenda.'} onRetry={load} /> : null}

      {state === 'ready' && data ? (
        <>
          <Card>
            <CardContent className="space-y-3">
              <SectionHeader title="Servizi nel periodo" subtitle="Tutte le prenotazioni e gli appuntamenti nell’intervallo selezionato." />
              {data.items.length ? (
                <div className="space-y-3">
                  {data.items.map((item) => (
                    <TimelineCard
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      canManage={canManage}
                      onStatusChange={(nextStatus) => handleBookingStatus(item, nextStatus)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyCard label="Nessun servizio nel periodo selezionato." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <SectionHeader title="Slot disponibili" subtitle="Capienza e occupazione degli slot nel periodo." />
              {data.slots.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {data.slots.map((slot) => (
                    <Card key={slot.id} className="admin-listCard">
                      <CardContent className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="ui-body font-[var(--font-weight-semibold)]">
                              {getAdminServiceLabel(slot.serviceType as AdminServiceKey, slot.serviceType, slot.serviceVariant)}
                            </div>
                            <div className="ui-muted">{formatDateTime(slot.startAt)} → {formatDateTime(slot.endAt)}</div>
                          </div>
                          <span className="ui-accentPill">{slot.bookedCount}/{slot.capacity}</span>
                        </div>
                        {slot.notes ? <div className="ui-muted">{slot.notes}</div> : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyCard label="Nessuno slot nel periodo selezionato." />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function ServicesTab({ canManage }: { canManage: boolean }) {
  const [serviceKey, setServiceKey] = useState<AdminServiceKey>('PENSIONE');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(plusDaysIso(14));
  const [status, setStatus] = useState('ALL');
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminAgendaItem[]>([]);

  const load = async () => {
    setState('loading');
    setError(null);
    try {
      const payload = await fetchAdminJson<{ items: AdminAgendaItem[] }>(
        `/api/admin/services?service=${serviceKey}&start=${startDate}&end=${endDate}&status=${status}`
      );
      setItems(payload.items);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore vista servizi.');
      setState('error');
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchAdminJson<{ items: AdminAgendaItem[] }>(
      `/api/admin/services?service=${serviceKey}&start=${startDate}&end=${endDate}&status=${status}`
    )
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore vista servizi.');
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [serviceKey, startDate, endDate, status]);

  const handleBookingStatus = async (item: AdminAgendaItem, nextStatus: BookingStatus | ServiceStatus) => {
    const kind = item.kind === 'SERVICE_SLOT' ? 'service-slot' : 'pensione';
    await fetchAdminJson(`/api/admin/bookings/${kind}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1 md:col-span-2">
            <label className="ui-label">Servizio</label>
            <select value={serviceKey} onChange={(event) => setServiceKey(event.target.value as AdminServiceKey)} className="ui-control ui-select">
              {ADMIN_SERVICE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="ui-label">Dal</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="ui-control ui-input" />
          </div>
          <div className="space-y-1">
            <label className="ui-label">Al</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="ui-control ui-input" />
          </div>
          <div className="space-y-1">
            <label className="ui-label">Stato</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="ui-control ui-select">
              <option value="ALL">Tutti</option>
              <option value="PENDING">In attesa</option>
              <option value="CONFIRMED">Confermate</option>
              <option value="PAID">Pagate</option>
              <option value="COMPLETED">Completate</option>
              <option value="CANCELLED">Annullate</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {state === 'loading' || state === 'idle' ? <LoadingCard label="Caricamento servizi..." /> : null}
      {state === 'error' ? <ErrorCard error={error ?? 'Errore servizi.'} onRetry={load} /> : null}
      {state === 'ready' ? (
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title={getAdminServiceLabel(serviceKey)} subtitle="Tutte le prenotazioni filtrate per servizio e periodo." />
            {items.length ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <TimelineCard
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    canManage={canManage}
                    onStatusChange={(nextStatus) => handleBookingStatus(item, nextStatus)}
                  />
                ))}
              </div>
            ) : (
              <EmptyCard label="Nessuna prenotazione per il servizio selezionato." />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ConfigTab({ canManage }: { canManage: boolean }) {
  const [slotsStartDate, setSlotsStartDate] = useState(todayIso());
  const [slotsEndDate, setSlotsEndDate] = useState(plusDaysIso(30));
  const [slotServiceType, setSlotServiceType] = useState<ServiceType | 'ALL'>('ALL');
  const [slotsState, setSlotsState] = useState<LoadState>('loading');
  const [staffState, setStaffState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AdminSlotRecord[]>([]);
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [slotForm, setSlotForm] = useState({
    slotId: '',
    serviceType: 'ASILO' as ServiceType,
    serviceVariant: 'HALF' as ServiceVariant | '',
    startAt: '',
    endAt: '',
    capacity: 1,
    isActive: true,
    notes: '',
  });
  const [staffForm, setStaffForm] = useState({
    email: '',
    role: 'VIEWER' as StaffRole,
    isActive: true,
  });
  const [savingSlot, setSavingSlot] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);

  const loadSlots = async () => {
    setSlotsState('loading');
    setError(null);
    try {
      const payload = await fetchAdminJson<{ items: AdminSlotRecord[] }>(
        `/api/admin/slots?start=${slotsStartDate}&end=${slotsEndDate}&serviceType=${slotServiceType}`
      );
      setSlots(payload.items);
      setSlotsState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore slot.');
      setSlotsState('error');
    }
  };

  const loadStaff = async () => {
    setStaffState('loading');
    setError(null);
    try {
      const payload = await fetchAdminJson<{ items: AdminStaffMember[] }>('/api/admin/staff');
      setStaff(payload.items);
      setStaffState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore staff.');
      setStaffState('error');
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchAdminJson<{ items: AdminSlotRecord[] }>(
      `/api/admin/slots?start=${slotsStartDate}&end=${slotsEndDate}&serviceType=${slotServiceType}`
    )
      .then((payload) => {
        if (cancelled) return;
        setSlots(payload.items);
        setSlotsState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore slot.');
        setSlotsState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [slotsStartDate, slotsEndDate, slotServiceType]);

  useEffect(() => {
    let cancelled = false;

    fetchAdminJson<{ items: AdminStaffMember[] }>('/api/admin/staff')
      .then((payload) => {
        if (cancelled) return;
        setStaff(payload.items);
        setStaffState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Errore staff.');
        setStaffState('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSlot = async () => {
    setSavingSlot(true);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/slots', {
        method: 'POST',
        body: JSON.stringify({
          slotId: slotForm.slotId || null,
          serviceType: slotForm.serviceType,
          serviceVariant: slotForm.serviceVariant || null,
          startAt: slotForm.startAt,
          endAt: slotForm.endAt,
          capacity: Number(slotForm.capacity),
          isActive: slotForm.isActive,
          notes: slotForm.notes || null,
        }),
      });
      setSlotForm({
        slotId: '',
        serviceType: 'ASILO',
        serviceVariant: 'HALF',
        startAt: '',
        endAt: '',
        capacity: 1,
        isActive: true,
        notes: '',
      });
      await loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio slot.');
    } finally {
      setSavingSlot(false);
    }
  };

  const saveStaff = async () => {
    setSavingStaff(true);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(staffForm),
      });
      setStaffForm({ email: '', role: 'VIEWER', isActive: true });
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio staff.');
    } finally {
      setSavingStaff(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <div className="ui-error">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Staff gestionale" subtitle="Assegna accesso completo o sola lettura." />
            <div className="grid gap-3">
              <input
                value={staffForm.email}
                onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))}
                className="ui-control ui-input"
                placeholder="email@esempio.it"
                disabled={!canManage || savingStaff}
              />
              <select
                value={staffForm.role}
                onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value as StaffRole }))}
                className="ui-control ui-select"
                disabled={!canManage || savingStaff}
              >
                {STAFF_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="ui-checkboxLabel">
                <input
                  type="checkbox"
                  checked={staffForm.isActive}
                  onChange={(event) => setStaffForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="ui-checkbox"
                  disabled={!canManage || savingStaff}
                />
                Account attivo
              </label>
              {canManage ? (
                <Button disabled={savingStaff} onClick={saveStaff}>
                  {savingStaff ? 'Salvataggio...' : 'Salva membro staff'}
                </Button>
              ) : (
                <div className="ui-muted">Account viewer: sola consultazione.</div>
              )}
            </div>

            {staffState === 'loading' || staffState === 'idle' ? <LoadingCard label="Caricamento staff..." /> : null}
            {staffState === 'ready' && staff.length ? (
              <div className="space-y-3">
                {staff.map((member) => (
                  <Card key={member.userId} className="admin-listCard">
                    <CardContent className="space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="ui-body font-[var(--font-weight-semibold)]">{member.email ?? member.userId}</div>
                          <div className="ui-muted">{getAdminRoleLabel(member.role)}</div>
                        </div>
                        <span className={member.isActive ? 'ui-accentPill' : 'admin-status admin-status--danger'}>
                          {member.isActive ? 'Attivo' : 'Disattivo'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <SectionHeader title="Gestione slot" subtitle="Crea o modifica disponibilità di asilo, addestramento e consulenza." />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={slotForm.slotId}
                onChange={(event) => setSlotForm((current) => ({ ...current, slotId: event.target.value }))}
                className="ui-control ui-input sm:col-span-2"
                placeholder="ID slot da modificare (opzionale)"
                disabled={!canManage || savingSlot}
              />
              <select
                value={slotForm.serviceType}
                onChange={(event) => setSlotForm((current) => ({ ...current, serviceType: event.target.value as ServiceType }))}
                className="ui-control ui-select"
                disabled={!canManage || savingSlot}
              >
                <option value="ASILO">Asilo</option>
                <option value="ADDESTRAMENTO">Addestramento</option>
                <option value="CONSULENZA">Consulenza</option>
                <option value="PENSIONE">Pensione</option>
              </select>
              <select
                value={slotForm.serviceVariant}
                onChange={(event) => setSlotForm((current) => ({ ...current, serviceVariant: event.target.value as ServiceVariant | '' }))}
                className="ui-control ui-select"
                disabled={!canManage || savingSlot}
              >
                <option value="">Nessuna variante</option>
                <option value="HALF">Half</option>
                <option value="FULL">Full</option>
                <option value="SESSION_60">Session 60</option>
              </select>
              <input
                type="datetime-local"
                value={slotForm.startAt}
                onChange={(event) => setSlotForm((current) => ({ ...current, startAt: event.target.value }))}
                className="ui-control ui-input"
                disabled={!canManage || savingSlot}
              />
              <input
                type="datetime-local"
                value={slotForm.endAt}
                onChange={(event) => setSlotForm((current) => ({ ...current, endAt: event.target.value }))}
                className="ui-control ui-input"
                disabled={!canManage || savingSlot}
              />
              <input
                type="number"
                min={1}
                value={slotForm.capacity}
                onChange={(event) => setSlotForm((current) => ({ ...current, capacity: Number(event.target.value) }))}
                className="ui-control ui-input"
                disabled={!canManage || savingSlot}
              />
              <label className="ui-checkboxLabel">
                <input
                  type="checkbox"
                  checked={slotForm.isActive}
                  onChange={(event) => setSlotForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="ui-checkbox"
                  disabled={!canManage || savingSlot}
                />
                Slot attivo
              </label>
              <textarea
                value={slotForm.notes}
                onChange={(event) => setSlotForm((current) => ({ ...current, notes: event.target.value }))}
                className="ui-control ui-textarea sm:col-span-2"
                placeholder="Note slot"
                disabled={!canManage || savingSlot}
              />
              {canManage ? (
                <Button className="sm:col-span-2" disabled={savingSlot} onClick={saveSlot}>
                  {savingSlot ? 'Salvataggio...' : 'Salva slot'}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <SectionHeader title="Slot nel periodo" subtitle="Vista operativa per capienza e prenotazioni associate." />
          <div className="grid gap-3 md:grid-cols-4">
            <input type="date" value={slotsStartDate} onChange={(event) => setSlotsStartDate(event.target.value)} className="ui-control ui-input" />
            <input type="date" value={slotsEndDate} onChange={(event) => setSlotsEndDate(event.target.value)} className="ui-control ui-input" />
            <select value={slotServiceType} onChange={(event) => setSlotServiceType(event.target.value as ServiceType | 'ALL')} className="ui-control ui-select">
              <option value="ALL">Tutti i servizi</option>
              <option value="ASILO">Asilo</option>
              <option value="ADDESTRAMENTO">Addestramento</option>
              <option value="CONSULENZA">Consulenza</option>
              <option value="PENSIONE">Pensione</option>
            </select>
            <Button variant="secondary" onClick={loadSlots}>
              Aggiorna slot
            </Button>
          </div>

          {slotsState === 'loading' || slotsState === 'idle' ? <LoadingCard label="Caricamento slot..." /> : null}
          {slotsState === 'error' ? <ErrorCard error={error ?? 'Errore slot.'} onRetry={loadSlots} /> : null}
          {slotsState === 'ready' && slots.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    setSlotForm({
                      slotId: slot.id,
                      serviceType: slot.serviceType,
                      serviceVariant: slot.serviceVariant ?? '',
                      startAt: slot.startAt.slice(0, 16),
                      endAt: slot.endAt.slice(0, 16),
                      capacity: slot.capacity,
                      isActive: slot.isActive,
                      notes: slot.notes ?? '',
                    })
                  }
                >
                  <Card className="admin-listCard">
                    <CardContent className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="ui-body font-[var(--font-weight-semibold)]">
                            {getAdminServiceLabel(slot.serviceType as AdminServiceKey, slot.serviceType, slot.serviceVariant)}
                          </div>
                          <div className="ui-muted">{formatDateTime(slot.startAt)} → {formatDateTime(slot.endAt)}</div>
                        </div>
                        <span className="ui-accentPill">{slot.bookedCount}/{slot.capacity}</span>
                      </div>
                      <div className="ui-muted">{slot.notes || 'Nessuna nota'}</div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminConsole() {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [tab, setTab] = useState<AdminTab>('overview');
  const [accessState, setAccessState] = useState<LoadState>('idle');
  const [access, setAccess] = useState<AdminStaffAccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadAccess() {
      setAccessState('loading');
      setError(null);

      try {
        const payload = await fetchAdminJson<AdminStaffAccess>('/api/admin/me');
        if (cancelled) return;
        setAccess(payload);
        setAccessState('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Accesso gestionale non disponibile.');
        setAccessState('error');
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const canManage = access?.canManage ?? false;

  const tabContent = useMemo(() => {
    if (tab === 'overview') return <OverviewTab canManage={canManage} />;
    if (tab === 'users') return <UsersTab canManage={canManage} />;
    if (tab === 'dogs') return <DogsTab canManage={canManage} />;
    if (tab === 'dates') return <DateTab canManage={canManage} />;
    if (tab === 'services') return <ServicesTab canManage={canManage} />;
    return <ConfigTab canManage={canManage} />;
  }, [tab, canManage]);

  if (authLoading || accessState === 'loading' || accessState === 'idle') {
    return (
      <main className="ui-page min-h-screen">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <LoadingCard label="Preparazione gestionale..." />
        </div>
      </main>
    );
  }

  if (!user) return null;

  if (accessState === 'error' || !access) {
    return (
      <main className="ui-page min-h-screen">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
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
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 space-y-4">
        <Card className="admin-heroCard">
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="ui-accentPill w-fit">Gestionale</div>
                <h1 className="ui-title">Tenuta del Barone Backoffice</h1>
                <p className="ui-muted">
                  Vista unica per clienti, cani, prenotazioni, servizi, documenti e configurazione operativa.
                </p>
              </div>
              <div className="admin-inlineControls">
                <span className="ui-accentPill">{canManage ? 'Poteri completi' : 'Sola lettura'}</span>
                <Button variant="secondary" onClick={() => router.push('/services')}>
                  Torna all&apos;app
                </Button>
              </div>
            </div>

            <div className="admin-tabBar">
              {ADMIN_TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cx('admin-tabButton', tab === item.key && 'admin-tabButton--active')}
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
