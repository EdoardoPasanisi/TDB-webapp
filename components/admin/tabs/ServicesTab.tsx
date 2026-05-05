'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type {
  AdminAgendaItem,
  AdminServiceKey,
  AdminServicesViewResponse,
} from '@/lib/admin/types';
import type { BookingStatus } from '@/types/booking';
import type { ServiceStatus } from '@/types/services';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  SERVICE_MULTI_OPTIONS,
  cx,
  formatDateTime,
  todayIso,
  EmptyCard,
  ErrorCard,
  LoadingCard,
  TimelineCard,
} from '@/components/admin/shared';
import { BookingDetailModal } from '@/components/admin/modals';
import { Button } from '@/components/ui/Button';
import { getAdminServiceLabel } from '@/lib/admin/utils';

function formatServiceDayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00`);
  const label = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getStatusFilterLabel(value: string) {
  if (value === 'ALL') return 'Tutti gli stati';
  if (value === 'PENDING') return 'In attesa';
  if (value === 'CONFIRMED') return 'Confermate';
  if (value === 'PAID') return 'Pagate';
  if (value === 'COMPLETED') return 'Completate';
  if (value === 'CANCELLED') return 'Annullate';
  return value;
}

function getServiceSectionStyle(serviceKey: AdminServiceKey): CSSProperties {
  if (serviceKey === 'PENSIONE') {
    return {
      borderWidth: '2px',
      borderColor: 'rgba(255,130,0,0.88)',
      background: 'linear-gradient(180deg, rgba(255,130,0,0.16), rgba(255,130,0,0.06))',
    };
  }
  if (serviceKey === 'ASILO') {
    return {
      borderWidth: '2px',
      borderColor: 'rgba(59,130,246,0.88)',
      background: 'linear-gradient(180deg, rgba(59,130,246,0.16), rgba(59,130,246,0.06))',
    };
  }
  if (serviceKey === 'ADDESTRAMENTO') {
    return {
      borderWidth: '2px',
      borderColor: 'rgba(34,197,94,0.88)',
      background: 'linear-gradient(180deg, rgba(34,197,94,0.16), rgba(34,197,94,0.06))',
    };
  }
  if (serviceKey === 'CONSULENZA') {
    return {
      borderWidth: '2px',
      borderColor: 'rgba(234,179,8,0.88)',
      background: 'linear-gradient(180deg, rgba(234,179,8,0.16), rgba(234,179,8,0.06))',
    };
  }
  if (serviceKey === 'TOELETTATURA') {
    return {
      borderWidth: '2px',
      borderColor: 'rgba(244,114,182,0.88)',
      background: 'linear-gradient(180deg, rgba(244,114,182,0.16), rgba(244,114,182,0.06))',
    };
  }
  if (serviceKey === 'TAXI_DOG') {
    return {
      borderWidth: '2px',
      borderColor: 'rgba(249,115,22,0.88)',
      background: 'linear-gradient(180deg, rgba(249,115,22,0.16), rgba(249,115,22,0.06))',
    };
  }
  return {
    borderWidth: '2px',
    borderColor: 'rgba(255,255,255,0.42)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
  };
}

const innerServiceCardStyle: CSSProperties = {
  borderWidth: '2px',
  borderColor: 'rgba(255,130,0,0.88)',
  background: 'linear-gradient(180deg, rgba(255,130,0,0.08), rgba(10,12,12,0.92) 28%)',
  boxShadow: 'inset 0 0 0 1px rgba(255,130,0,0.18)',
};

export function ServicesTab({ canManage }: { canManage: boolean }) {
  const [selectedServiceKeys, setSelectedServiceKeys] = useState<Array<AdminServiceKey | 'ALL'>>(['ALL']);
  const [usePeriod, setUsePeriod] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [status, setStatus] = useState('ALL');
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminServicesViewResponse | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminAgendaItem | null>(null);

  const effectiveStartDate = usePeriod ? startDate : date;
  const effectiveEndDate = usePeriod ? endDate : date;
  const servicesParam =
    selectedServiceKeys.includes('ALL') || selectedServiceKeys.length === 0
      ? 'ALL'
      : selectedServiceKeys.join(',');
  const selectedServiceLabels = selectedServiceKeys.includes('ALL')
    ? ['Tutti i servizi']
    : SERVICE_MULTI_OPTIONS.filter(
        (option) => option.key !== 'ALL' && selectedServiceKeys.includes(option.key)
      ).map((option) => option.label);
  const specificServiceCount = selectedServiceKeys.filter((key) => key !== 'ALL').length;
  const isGenericServiceView =
    selectedServiceKeys.includes('ALL') || specificServiceCount >= SERVICE_MULTI_OPTIONS.length - 1;
  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        dayKey: string;
        dayLabel: string;
        serviceGroups: Array<{
          serviceKey: AdminServiceKey;
          serviceLabel: string;
          items: AdminAgendaItem[];
        }>;
      }
    >();

    for (const item of data?.items ?? []) {
      const dayKey = item.startAt.slice(0, 10);
      const existing = groups.get(dayKey);
      if (existing) {
        const existingServiceGroup = existing.serviceGroups.find(
          (group) => group.serviceKey === item.serviceKey && group.serviceLabel === item.serviceLabel
        );
        if (existingServiceGroup) {
          existingServiceGroup.items.push(item);
        } else {
          existing.serviceGroups.push({
            serviceKey: item.serviceKey,
            serviceLabel: item.serviceLabel,
            items: [item],
          });
        }
        continue;
      }

      groups.set(dayKey, {
        dayKey,
        dayLabel: formatServiceDayLabel(dayKey),
        serviceGroups: [
          {
            serviceKey: item.serviceKey,
            serviceLabel: item.serviceLabel,
            items: [item],
          },
        ],
      });
    }

    return Array.from(groups.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [data?.items]);

  const toggleServiceKey = (key: AdminServiceKey | 'ALL') => {
    setSelectedServiceKeys((current) => {
      if (key === 'ALL') return ['ALL'];

      const next = current.filter((value) => value !== 'ALL') as AdminServiceKey[];
      if (next.includes(key)) {
        const filtered = next.filter((value) => value !== key);
        return filtered.length ? filtered : ['ALL'];
      }

      return [...next, key];
    });
  };

  const load = async () => {
    setState('loading');
    setError(null);
    try {
      const payload = await fetchAdminJson<AdminServicesViewResponse>(
        `/api/admin/services?services=${encodeURIComponent(servicesParam)}&start=${effectiveStartDate}&end=${effectiveEndDate}&status=${status}`
      );
      setData(payload);
      setState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare la vista servizi.'));
      setState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchAdminJson<AdminServicesViewResponse>(
      `/api/admin/services?services=${encodeURIComponent(servicesParam)}&start=${effectiveStartDate}&end=${effectiveEndDate}&status=${status}`,
      { signal: controller.signal }
    )
      .then((payload) => {
        setData(payload);
        setState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare la vista servizi.'));
        setState('error');
      });

    return () => {
      controller.abort();
    };
  }, [effectiveEndDate, effectiveStartDate, servicesParam, status]);

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
        <CardContent className="space-y-4 md:space-y-6 md:px-7 md:py-7">
          <div className="ui-panelInset space-y-3 p-3 md:space-y-4 md:border md:border-[rgba(255,255,255,0.12)] md:bg-[rgba(255,255,255,0.025)] md:px-5 md:py-5">
            <div className="ui-body font-[var(--font-weight-semibold)]">Servizi</div>
            <div className="admin-choiceGrid">
              {SERVICE_MULTI_OPTIONS.map((option) => {
                const active =
                  option.key === 'ALL'
                    ? selectedServiceKeys.includes('ALL')
                    : !selectedServiceKeys.includes('ALL') && selectedServiceKeys.includes(option.key);

                return (
                  <button
                    key={option.key}
                    type="button"
                    className={cx('admin-tabButton admin-choiceButton', active && 'admin-tabButton--active')}
                    onClick={() => toggleServiceKey(option.key)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ui-panelInset space-y-3 p-3 md:space-y-4 md:border md:border-[rgba(255,255,255,0.12)] md:bg-[rgba(255,255,255,0.025)] md:px-5 md:py-5">
            <div className="ui-body font-[var(--font-weight-semibold)]">Intervallo</div>
            <div className="admin-choiceGrid">
              <button
                type="button"
                className={cx('admin-tabButton admin-choiceButton', !usePeriod && 'admin-tabButton--active')}
                onClick={() => {
                  setUsePeriod(false);
                  setDate(startDate);
                }}
              >
                Giorno
              </button>
              <button
                type="button"
                className={cx('admin-tabButton admin-choiceButton', usePeriod && 'admin-tabButton--active')}
                onClick={() => {
                  setUsePeriod(true);
                  setStartDate(date);
                  setEndDate(date);
                }}
              >
                Periodo
              </button>
            </div>
          </div>

          <div className="ui-panelInset space-y-3 p-3 md:space-y-4 md:border md:border-[rgba(255,255,255,0.12)] md:bg-[rgba(255,255,255,0.025)] md:px-5 md:py-5">
            <div className="ui-body font-[var(--font-weight-semibold)]">Filtri</div>
            <div className={cx('grid gap-3 md:gap-4', usePeriod ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
              <div className="space-y-2">
                <label className="ui-label">{usePeriod ? 'Dal' : 'Data'}</label>
                <input
                  type="date"
                  value={usePeriod ? startDate : date}
                  onChange={(event) => (usePeriod ? setStartDate(event.target.value) : setDate(event.target.value))}
                  className="ui-control ui-input"
                />
              </div>
              {usePeriod ? (
                <div className="space-y-2">
                  <label className="ui-label">Al</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="ui-control ui-input"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
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
            </div>
          </div>
        </CardContent>
      </Card>

      {state === 'loading' || state === 'idle' ? <LoadingCard label="Caricamento servizi..." /> : null}
      {state === 'error' ? <ErrorCard error={error ?? 'Errore servizi.'} onRetry={load} /> : null}
      {state === 'ready' && data ? (
        <>
          <div className="space-y-3">
            <SectionHeader
              title="Elenco servizi"
              subtitle={`${selectedServiceLabels.join(' · ')} • ${getStatusFilterLabel(status)} • dal ${formatDateTime(effectiveStartDate)}${effectiveEndDate !== effectiveStartDate ? ` al ${formatDateTime(effectiveEndDate)}` : ''}`}
            />
            {data.items.length ? (
              <div className="space-y-5">
                {groupedItems.map((group) => (
                  <section key={group.dayKey} className="space-y-3">
                    <div className="px-1">
                      <div className="ui-body font-[var(--font-weight-semibold)]">{group.dayLabel}</div>
                      <div className="ui-muted mt-1">
                        {group.serviceGroups.reduce((total, serviceGroup) => total + serviceGroup.items.length, 0)}{' '}
                        {group.serviceGroups.reduce((total, serviceGroup) => total + serviceGroup.items.length, 0) === 1
                          ? 'servizio programmato'
                          : 'servizi programmati'}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {group.serviceGroups.map((serviceGroup) => (
                        <Card
                          key={`${group.dayKey}-${serviceGroup.serviceKey}-${serviceGroup.serviceLabel}`}
                          className="overflow-hidden"
                          style={getServiceSectionStyle(serviceGroup.serviceKey)}
                        >
                          <CardContent className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <div className="ui-body font-[var(--font-weight-semibold)]">
                                  {serviceGroup.serviceLabel}
                                </div>
                                <div className="ui-muted">
                                  {serviceGroup.items.length} attività
                                </div>
                              </div>
                              <span className="ui-accentPill">{serviceGroup.serviceLabel}</span>
                            </div>

                            <div className="space-y-3">
                              {serviceGroup.items.map((item) => (
                                <TimelineCard
                                  key={item.itemKey}
                                  item={item}
                                  canManage={canManage}
                                  layout={isGenericServiceView ? 'default' : 'service'}
                                  cardStyle={innerServiceCardStyle}
                                  onOpenDetail={() => setSelectedBooking(item)}
                                  onStatusChange={(nextStatus) => handleBookingStatus(item, nextStatus)}
                                />
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyCard label="Nessun servizio per i filtri selezionati." />
            )}
          </div>

          <Card>
            <CardContent className="space-y-3">
              <SectionHeader title="Slot disponibili" subtitle="Capienza e occupazione degli slot nel periodo selezionato." />
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
                            <div className="ui-muted">
                              {formatDateTime(slot.startAt)} → {formatDateTime(slot.endAt)}
                            </div>
                          </div>
                          <span className="ui-accentPill">
                            {slot.bookedCount}/{slot.capacity}
                          </span>
                        </div>
                        {slot.notes ? <div className="ui-muted">{slot.notes}</div> : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyCard label="Nessuno slot per i filtri selezionati." />
              )}
            </CardContent>
          </Card>

          <BookingDetailModal
            key={selectedBooking ? `${selectedBooking.kind}-${selectedBooking.id}` : 'services-booking-detail-empty'}
            item={selectedBooking}
            open={Boolean(selectedBooking)}
            onClose={() => setSelectedBooking(null)}
          />
        </>
      ) : null}
    </div>
  );
}
