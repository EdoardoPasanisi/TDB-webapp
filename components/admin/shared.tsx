'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  AdminAgendaItem,
  AdminBookingDetail,
  AdminDocumentRecord,
  AdminServiceKey,
} from '@/lib/admin/types';
import {
  ADMIN_SERVICE_OPTIONS,
  getAdminStatusLabel,
} from '@/lib/admin/utils';
import type { Profile } from '@/types/profile';
import type { ProfileFormState } from '@/types/forms';
import type { Dog } from '@/types/dog';
import type { BookingStatus } from '@/types/booking';
import type { ServiceStatus } from '@/types/services';
import { isValidItalianFiscalCode, sanitizeFiscalCode } from '@/lib/validation/italy';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export type AdminTab = 'overview' | 'users' | 'dogs' | 'services' | 'chat' | 'media' | 'analytics' | 'config';
export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const ADMIN_TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Stato' },
  { key: 'users', label: 'Utenti' },
  { key: 'dogs', label: 'Pet' },
  { key: 'services', label: 'Servizi' },
  { key: 'chat', label: 'Chat' },
  { key: 'media', label: 'Media' },
  { key: 'analytics', label: 'Analisi' },
  { key: 'config', label: 'Config' },
];

export const SERVICE_MULTI_OPTIONS: Array<{ key: AdminServiceKey | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'Tutti' },
  ...ADMIN_SERVICE_OPTIONS,
];

export const SEARCH_DEBOUNCE_MS = 250;
export const ADMIN_TAB_STORAGE_KEY = 'admin-console-tab-v1';
export const ADMIN_ACCESS_STORAGE_KEY = 'admin-access-v1';

export const EMPTY_PROFILE_FORM: ProfileFormState = {
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

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateTime(value: string | null | undefined) {
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

export function formatEuro(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

export function formatAddressValue(parts: Array<string | null | undefined>) {
  const value = parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(', ');
  return value || null;
}

export function formatTimeOnly(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;

  const rawTimeMatch = normalized.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  if (rawTimeMatch) return rawTimeMatch[1] ?? normalized;

  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return normalized;
}

export function formatDogSexLabel(value: AdminBookingDetail['dogs'][number]['sex'] | Dog['sex'] | null | undefined) {
  if (value === 'male') return 'Maschio';
  if (value === 'female') return 'Femmina';
  return null;
}

export function formatGroomingDifficultyLabel(value: Dog['grooming_difficulty'] | null | undefined) {
  if (value === 1) return 'Bassa';
  if (value === 2) return 'Media';
  if (value === 3) return 'Alta';
  return null;
}

export function formatTaxiOptionLabel(value: AdminBookingDetail['taxi']['option']) {
  if (value === 'ONE_WAY') return 'Solo andata';
  if (value === 'RETURN_ONLY') return 'Solo ritorno';
  if (value === 'ROUND_TRIP') return 'Andata e ritorno';
  if (value === 'NONE') return 'Non richiesto';
  return null;
}

export function formatTaxiDistanceBandLabel(value: AdminBookingDetail['booking']['taxiDistanceBand']) {
  if (value === 'ENTRO_40') return 'Entro 40 km';
  if (value === 'OLTRE_40') return 'Oltre 40 km';
  return null;
}

export function formatAccommodationTypeLabel(value: string | null | undefined) {
  switch (value) {
    case 'BOX':
      return 'Box';
    case 'BOX_GARDEN':
      return 'Box con giardino';
    case 'CHALET':
      return 'Chalet';
    case 'APT_GARDEN':
      return 'Appartamento con giardino';
    case 'APT_GARDEN_NIGHT_PERSON':
      return 'Appartamento con giardino e presenza notturna';
    case 'HOTEL':
      return 'Hotel - stanza luxury con giardino e aria condizionata';
    case 'CATTERY':
      return 'Catery';
    default:
      return value ? value.replaceAll('_', ' ') : null;
  }
}

export function isPresentValue(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export { buildRequiredOwnerMissing, buildRequiredDogMissing } from '@/lib/admin/requirements';

export function toLocalDateTime(dayKey: string, timeValue: string) {
  const normalizedTime = formatTimeOnly(timeValue) ?? '00:00';
  return `${dayKey}T${normalizedTime}`;
}

export function addDaysToDateKey(dayKey: string, days: number) {
  const date = new Date(`${dayKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

export function enumerateDateKeys(startDay: string, endDay: string) {
  const items: string[] = [];
  let cursor = startDay;

  while (cursor <= endDay) {
    items.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }

  return items;
}

export function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
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

export function initProfileForm(profile: Profile | null): ProfileFormState {
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

export function buildProfilePayload(form: ProfileFormState, currentProfile: Profile | null): Partial<Profile> {
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

function nextStatuses(status: string | null | undefined): Array<{
  label: string;
  status: BookingStatus | ServiceStatus;
  variant?: 'secondary' | 'danger';
}> {
  if (status === 'DRAFT' || status === 'PENDING') {
    return [
      { label: 'Conferma', status: 'CONFIRMED' },
      { label: 'Annulla', status: 'CANCELLED', variant: 'danger' },
    ];
  }

  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    return [
      { label: 'Segna pagata', status: 'PAID' },
      { label: 'Annulla', status: 'CANCELLED', variant: 'danger' },
    ];
  }

  if (status === 'PAID') {
    return [
      { label: 'Riporta a confermata', status: 'CONFIRMED', variant: 'secondary' },
      { label: 'Annulla', status: 'CANCELLED', variant: 'danger' },
    ];
  }

  if (status === 'CANCELLED' || status === 'REJECTED') {
    return [{ label: 'Ripristina (conferma)', status: 'CONFIRMED', variant: 'secondary' }];
  }

  return [];
}

export function statusTone(status: string | null | undefined) {
  if (status === 'PENDING') return 'admin-status admin-status--pending';
  if (status === 'CONFIRMED') return 'admin-status admin-status--confirmed';
  if (status === 'PAID') return 'admin-status admin-status--paid';
  if (status === 'COMPLETED') return 'admin-status admin-status--completed';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'admin-status admin-status--danger';
  if (status === 'ACCEPTED') return 'admin-status admin-status--accepted';
  return 'admin-status';
}

function getDocumentStatusLabel(status: AdminDocumentRecord['status']): string {
  if (status === 'PENDING') return 'In attesa';
  if (status === 'ACCEPTED') return 'Accettato';
  if (status === 'REJECTED') return 'Rifiutato';
  return status;
}

export function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'primary';
}) {
  return (
    <Card className={cx('admin-metricCard', tone === 'primary' && 'admin-metricCard--primary')}>
      <CardContent className="space-y-1">
        <div className={cx('ui-muted', tone === 'primary' && 'admin-metricLabel--primary')}>{label}</div>
        <div className={cx('admin-metricValue', tone === 'primary' && 'admin-metricValue--primary')}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function LoadingCard({ label = 'Caricamento...' }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className="ui-spinner" />
        <div className="ui-muted">{label}</div>
      </CardContent>
    </Card>
  );
}

export function ErrorCard({ error, onRetry }: { error: string; onRetry?: () => void }) {
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

export function EmptyCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="ui-muted">{label}</CardContent>
    </Card>
  );
}

export function ModalFrame({
  open,
  title,
  onClose,
  children,
  maxWidthClassName = 'sm:max-w-3xl',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="ui-modalOverlay" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 top-auto sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-4">
        <div
          className={cx('ui-modalPanel w-full max-h-[92vh] overflow-auto', maxWidthClassName)}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="ui-modalHeader items-start">
            <div className="space-y-1">
              <h2 className="ui-h2">{title}</h2>
            </div>
            <Button type="button" variant="secondary" onClick={onClose}>
              Chiudi
            </Button>
          </div>
          <div className="p-4 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SummaryBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="ui-panelInset p-3">
      <div className="ui-muted">{label}</div>
      <div className="ui-body mt-1">{value}</div>
    </div>
  );
}

type DetailItem = {
  label: string;
  value: ReactNode;
};

export function DetailRows({
  items,
  columns = 2,
}: {
  items: DetailItem[];
  columns?: 1 | 2;
}) {
  const visibleItems = items.filter((item) => isPresentValue(item.value));
  if (!visibleItems.length) return null;

  return (
    <div className={cx('grid gap-x-5 gap-y-3', columns === 2 && 'sm:grid-cols-2')}>
      {visibleItems.map((item) => (
        <div key={item.label} className="border-b border-black/5 pb-2 last:border-b-0">
          <div className="ui-muted">{item.label}</div>
          <div className="ui-body mt-1 break-words">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function DetailSection({
  title,
  items = [],
  columns = 2,
  children,
}: {
  title: string;
  items?: DetailItem[];
  columns?: 1 | 2;
  children?: ReactNode;
}) {
  const hasItems = items.some((item) => isPresentValue(item.value));
  if (!hasItems && !children) return null;

  return (
    <section className="space-y-2">
      <div className="ui-body font-[var(--font-weight-semibold)]">{title}</div>
      {hasItems ? <DetailRows items={items} columns={columns} /> : null}
      {children}
    </section>
  );
}

export function MissingAlert({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[#ff7c38]/70 bg-[#24110b] px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.24)]">
      <div className="text-[16px] font-[var(--font-weight-semibold)] leading-[1.3] text-[#ff8c4a]">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.35] text-[#ff9f63] marker:text-[#ff7c38]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function HighlightBox({
  title,
  children,
  tone = 'accent',
}: {
  title: string;
  children: ReactNode;
  tone?: 'accent' | 'danger';
}) {
  const titleClass =
    tone === 'danger'
      ? 'text-[16px] font-[var(--font-weight-semibold)] leading-[1.3] text-[var(--text)]'
      : 'text-[16px] font-[var(--font-weight-semibold)] leading-[1.3] text-[var(--text)]';
  const bodyClass =
    tone === 'danger'
      ? 'mt-2 text-[15px] leading-[1.35] text-[var(--text)]'
      : 'mt-2 text-[15px] leading-[1.35] text-[var(--text)]';

  return (
    <div
      className={cx(
        'rounded-[var(--radius-lg)] border px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.2)]',
        tone === 'danger'
          ? 'border-[#ff7c38]/60 bg-[#21110d]'
          : 'border-[rgba(255,130,0,0.45)] bg-[rgba(20,24,23,0.98)]'
      )}
    >
      <div className={titleClass}>{title}</div>
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <span className={statusTone(status)}>{getAdminStatusLabel(status as BookingStatus | ServiceStatus | null)}</span>;
}

export function TimelineCard({
  item,
  canManage,
  showUser = true,
  layout = 'default',
  cardClassName,
  cardStyle,
  onStatusChange,
  onOpenDetail,
}: {
  item: AdminAgendaItem;
  canManage: boolean;
  showUser?: boolean;
  layout?: 'default' | 'service';
  cardClassName?: string;
  cardStyle?: CSSProperties;
  onStatusChange?: (nextStatus: BookingStatus | ServiceStatus) => Promise<void> | void;
  onOpenDetail?: () => void;
}) {
  const actions = nextStatuses(item.status);
  const isServiceLayout = layout === 'service';

  if (isServiceLayout) {
    const title = item.dogNames.length ? item.dogNames.join(', ') : item.serviceLabel;
    const detailLines = item.summaryLines.length
      ? item.summaryLines
      : [
          item.endAt
            ? `${formatDateTime(item.startAt)} → ${formatDateTime(item.endAt)}`
            : formatDateTime(item.startAt),
        ];

    return (
      <Card className={cx('admin-listCard', cardClassName)} style={cardStyle}>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <span className="ui-accentPill">{item.serviceLabel}</span>
            <StatusBadge status={item.status} />
          </div>

          <div className="space-y-1">
            <div className="ui-title">{title}</div>
            <div className="ui-muted">{item.userName}</div>
          </div>

          <div className="ui-panelInset p-3 space-y-1">
            {detailLines.map((line) => (
              <div key={`${item.itemKey}-${line}`} className="ui-body">
                {line}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="ui-muted">{formatDateTime(item.startAt)}</div>
            <div className="flex flex-wrap gap-2">
              {onOpenDetail ? (
                <Button variant="secondary" className="ui-btnCompact" onClick={onOpenDetail}>
                  Dettagli prenotazione
                </Button>
              ) : null}
              {canManage && onStatusChange
                ? actions.map((action) => (
                    <Button
                      key={action.status}
                      variant={action.variant ?? 'secondary'}
                      className="ui-btnCompact"
                      onClick={() => void onStatusChange(action.status)}
                    >
                      {action.label}
                    </Button>
                  ))
                : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cx('admin-listCard', cardClassName)} style={cardStyle}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {onOpenDetail ? (
              <button type="button" className="ui-body font-[var(--font-weight-semibold)] text-left underline-offset-2 hover:underline" onClick={onOpenDetail}>
                {item.serviceLabel}
              </button>
            ) : (
              <div className="ui-body font-[var(--font-weight-semibold)]">{item.serviceLabel}</div>
            )}
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

        {item.summaryLines.length ? (
          <div className="ui-panelInset p-3 space-y-1">
            {item.summaryLines.map((line) => (
              <div key={`${item.itemKey}-${line}`} className="ui-body">
                {line}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="ui-muted">{formatEuro(item.totalPrice)}</div>
          <div className="flex flex-wrap gap-2">
            {onOpenDetail ? (
              <Button variant="secondary" className="ui-btnCompact" onClick={onOpenDetail}>
                Dettagli
              </Button>
            ) : null}
            {canManage && onStatusChange
              ? actions.map((action) => (
                  <Button
                    key={action.status}
                    variant={action.variant ?? 'secondary'}
                    className="ui-btnCompact"
                    onClick={() => void onStatusChange(action.status)}
                  >
                    {action.label}
                  </Button>
                ))
              : null}
          </div>
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

export function DocumentCard({
  document,
  canManage,
  onDecision,
  onReRequest,
  onUpload,
  onOpenOwner,
}: {
  document: AdminDocumentRecord;
  canManage: boolean;
  onDecision?: (status: 'ACCEPTED' | 'REJECTED') => Promise<void> | void;
  onReRequest?: () => Promise<void> | void;
  onUpload?: (file: File) => Promise<void> | void;
  onOpenOwner?: (userId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelected = async (file: File | null) => {
    if (!file || !onUpload) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="admin-listCard">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-accentPill">
                {document.kind === 'ID_DOCUMENT' ? 'Documento di identità' : 'Liberatoria'}
              </span>
              <span className="ui-fine text-[rgba(255,255,255,0.42)]">
                Caricato il {formatDateTime(document.createdAt)}
              </span>
            </div>
            {document.ownerName ? (
              onOpenOwner ? (
                <button
                  type="button"
                  className="ui-body font-[var(--font-weight-semibold)] underline underline-offset-2 text-left"
                  onClick={() => onOpenOwner(document.userId)}
                >
                  {document.ownerName}
                </button>
              ) : (
                <div className="ui-body font-[var(--font-weight-semibold)]">{document.ownerName}</div>
              )
            ) : null}
            <div className="ui-fine text-[rgba(255,255,255,0.38)] break-all">
              {document.fileName}
            </div>
          </div>
          <span className={statusTone(document.status)}>
            {getDocumentStatusLabel(document.status)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {document.signedUrl ? (
            <a href={document.signedUrl} target="_blank" rel="noreferrer" className="ui-btn ui-btnSecondary ui-btnCompact">
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
          {canManage && onUpload ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = '';
                  void handleFileSelected(file);
                }}
              />
              <Button
                variant="secondary"
                className="ui-btnCompact"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Caricamento…' : 'Modifica'}
              </Button>
            </>
          ) : null}
          {canManage && document.status === 'ACCEPTED' && onReRequest ? (
            <Button variant="danger" className="ui-btnCompact" onClick={() => void onReRequest()}>
              Richiedi di nuovo
            </Button>
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
