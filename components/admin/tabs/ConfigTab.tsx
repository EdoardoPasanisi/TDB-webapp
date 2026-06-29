'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import type {
  AdminServiceKey,
  AdminSlotRecord,
  AdminStaffMember,
  AdminUserListItem,
  StaffRole,
} from '@/lib/admin/types';
import { STAFF_ROLE_OPTIONS, getAdminRoleLabel, getAdminServiceLabel } from '@/lib/admin/utils';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { MonthCalendar, type CalendarBookingItem } from '@/components/services/calendar/MonthCalendar';
import type { ServiceType, ServiceVariant } from '@/types/services';
import {
  SEARCH_DEBOUNCE_MS,
  cx,
  enumerateDateKeys,
  formatDateTime,
  formatTimeOnly,
  startOfMonth,
  startOfNextMonth,
  toDateOnly,
  toLocalDateTime,
  todayIso,
  EmptyCard,
  ErrorCard,
  LoadingCard,
  type LoadState,
} from '@/components/admin/shared';
import { useConfirm } from '@/components/admin/ConfirmProvider';
import { BreedCombobox } from '@/components/dogs/BreedCombobox';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { PensioneBlockRecord } from '@/lib/admin/pensioneBlocks';

export function ConfigTab({
  canManage,
  canManageStaff = false,
  currentUserId = null,
}: {
  canManage: boolean;
  canManageStaff?: boolean;
  currentUserId?: string | null;
}) {
  const confirm = useConfirm();
  const staffEditorRef = useRef<HTMLDivElement | null>(null);
  const staffSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [monthDate, setMonthDate] = useState<Date>(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState(todayIso());
  const [slotServiceType, setSlotServiceType] = useState<ServiceType | 'ALL'>('ALL');
  const [slotsState, setSlotsState] = useState<LoadState>('loading');
  const [staffState, setStaffState] = useState<LoadState>('loading');
  const [staffSearchState, setStaffSearchState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AdminSlotRecord[]>([]);
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [staffQuery, setStaffQuery] = useState('');
  const debouncedStaffQuery = useDebouncedValue(staffQuery, SEARCH_DEBOUNCE_MS);
  const [staffCandidates, setStaffCandidates] = useState<AdminUserListItem[]>([]);
  const [slotForm, setSlotForm] = useState({
    slotId: '',
    serviceType: 'ASILO' as ServiceType,
    serviceVariant: 'HALF' as ServiceVariant | '',
    startAt: `${todayIso()}T09:00`,
    endAt: `${todayIso()}T10:00`,
    capacity: 1,
    notes: '',
  });
  const [slotRepeatMode, setSlotRepeatMode] = useState<'DAY' | 'PERIOD'>('DAY');
  const [slotRepeatUntil, setSlotRepeatUntil] = useState(todayIso());
  const [staffForm, setStaffForm] = useState({
    userId: '',
    role: 'VIEWER' as StaffRole,
  });
  const [savingSlot, setSavingSlot] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);

  // Blocco prenotazioni pensione (per periodo, per tutti o per razze).
  const [blocks, setBlocks] = useState<PensioneBlockRecord[]>([]);
  const [blocksState, setBlocksState] = useState<LoadState>('loading');
  const [blockForm, setBlockForm] = useState<{
    blockId: string;
    startDate: string;
    endDate: string;
    scope: 'ALL' | 'BREEDS';
    breeds: string[];
    notes: string;
  }>({
    blockId: '',
    startDate: todayIso(),
    endDate: todayIso(),
    scope: 'ALL',
    breeds: [],
    notes: '',
  });
  const [blockBreedInput, setBlockBreedInput] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);
  const [deletingBlock, setDeletingBlock] = useState(false);

  const monthStartDate = useMemo(() => toDateOnly(startOfMonth(monthDate)), [monthDate]);
  const monthEndDate = useMemo(() => {
    const lastDay = new Date(startOfNextMonth(monthDate).getTime() - 24 * 60 * 60 * 1000);
    return toDateOnly(lastDay);
  }, [monthDate]);

  const selectedStaffCandidate = useMemo(
    () => staffCandidates.find((candidate) => candidate.userId === staffForm.userId) ?? null,
    [staffCandidates, staffForm.userId]
  );

  const selectedExistingStaffMember = useMemo(
    () => staff.find((member) => member.userId === staffForm.userId) ?? null,
    [staff, staffForm.userId]
  );

  // Un Admin può gestire qualunque ruolo, tranne sé stesso (anti-lockout).
  // Un ADMIN può gestire solo i membri "Sola lettura".
  const isSelfStaffMember = Boolean(currentUserId) && staffForm.userId === currentUserId;
  const canManageRole = (role: StaffRole | null | undefined) =>
    canManageStaff || (role ?? 'VIEWER') === 'VIEWER';
  const canManageSelectedTarget = !isSelfStaffMember && canManageRole(selectedExistingStaffMember?.role ?? null);
  const roleOptions = canManageStaff
    ? STAFF_ROLE_OPTIONS
    : STAFF_ROLE_OPTIONS.filter((option) => option.value === 'VIEWER');

  const scrollToStaffEditor = () => {
    window.requestAnimationFrame(() => {
      staffEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      staffSearchInputRef.current?.focus({ preventScroll: true });
    });
  };

  const editStaffMember = (member: AdminStaffMember) => {
    setError(null);
    setStaffForm({
      userId: member.userId,
      role: member.role,
    });
    setStaffQuery(member.fullName);
    setStaffCandidates([
      {
        userId: member.userId,
        fullName: member.fullName,
        email: member.email,
        phone: null,
        city: null,
        dogsCount: 0,
        activeBookings: 0,
        pendingDocuments: 0,
        dogNames: [],
        staffRole: member.role,
        walletDue: 0,
      },
    ]);
    setStaffSearchState('ready');
    scrollToStaffEditor();
  };

  const slotCalendarItems = useMemo<Array<CalendarBookingItem & { dayKey?: string }>>(
    () =>
      slots.map((slot) => ({
        id: slot.id,
        startAtIso: slot.startAt,
        endAtIso: slot.endAt,
        label: getAdminServiceLabel(slot.serviceType as AdminServiceKey, slot.serviceType, slot.serviceVariant),
        colorClass: '',
        dayKey: slot.startAt.slice(0, 10),
      })),
    [slots]
  );

  const selectedDaySlots = useMemo(
    () => slots.filter((slot) => slot.startAt.slice(0, 10) === selectedDayKey),
    [selectedDayKey, slots]
  );

  const selectedDaySlotGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        serviceType: ServiceType;
        serviceVariant: ServiceVariant | null;
        capacity: number;
        bookedCount: number;
        slots: AdminSlotRecord[];
      }
    >();

    for (const slot of selectedDaySlots) {
      const groupKey = `${slot.serviceType}:${slot.serviceVariant ?? ''}`;
      const current = groups.get(groupKey);

      if (current) {
        current.capacity += slot.capacity;
        current.bookedCount += slot.bookedCount;
        current.slots.push(slot);
        continue;
      }

      groups.set(groupKey, {
        key: groupKey,
        label: getAdminServiceLabel(slot.serviceType as AdminServiceKey, slot.serviceType, slot.serviceVariant),
        serviceType: slot.serviceType,
        serviceVariant: slot.serviceVariant ?? null,
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        slots: [slot],
      });
    }

    return Array.from(groups.values()).sort((left, right) => {
      const labelCompare = left.label.localeCompare(right.label, 'it');
      if (labelCompare !== 0) return labelCompare;
      return left.slots[0]?.startAt.localeCompare(right.slots[0]?.startAt ?? '') ?? 0;
    });
  }, [selectedDaySlots]);

  const loadSlots = async () => {
    setSlotsState('loading');
    setError(null);
    try {
      const payload = await fetchAdminJson<{ items: AdminSlotRecord[] }>(
        `/api/admin/slots?start=${monthStartDate}&end=${monthEndDate}&serviceType=${slotServiceType}`
      );
      setSlots(payload.items);
      setSlotsState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare gli slot disponibili.'));
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
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare gli accessi staff.'));
      setStaffState('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setSlotsState('loading');
    setError(null);

    fetchAdminJson<{ items: AdminSlotRecord[] }>(
      `/api/admin/slots?start=${monthStartDate}&end=${monthEndDate}&serviceType=${slotServiceType}`,
      { signal: controller.signal }
    )
      .then((payload) => {
        setSlots(payload.items);
        setSlotsState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare gli slot disponibili.'));
        setSlotsState('error');
      });

    return () => controller.abort();
  }, [monthEndDate, monthStartDate, slotServiceType]);

  const loadBlocks = async () => {
    setBlocksState('loading');
    try {
      const payload = await fetchAdminJson<{ items: PensioneBlockRecord[] }>(
        `/api/admin/pensione-blocks?start=${monthStartDate}&end=${monthEndDate}`
      );
      setBlocks(payload.items);
      setBlocksState('ready');
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i blocchi pensione.'));
      setBlocksState('error');
    }
  };

  useEffect(() => {
    if (!canManage) {
      setBlocksState('ready');
      return;
    }

    const controller = new AbortController();
    setBlocksState('loading');

    fetchAdminJson<{ items: PensioneBlockRecord[] }>(
      `/api/admin/pensione-blocks?start=${monthStartDate}&end=${monthEndDate}`,
      { signal: controller.signal }
    )
      .then((payload) => {
        setBlocks(payload.items);
        setBlocksState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare i blocchi pensione.'));
        setBlocksState('error');
      });

    return () => controller.abort();
  }, [canManage, monthEndDate, monthStartDate]);

  useEffect(() => {
    if (!canManage) {
      setStaffState('ready');
      return;
    }

    const controller = new AbortController();
    setStaffState('loading');
    setError(null);

    fetchAdminJson<{ items: AdminStaffMember[] }>('/api/admin/staff', { signal: controller.signal })
      .then((payload) => {
        setStaff(payload.items);
        setStaffState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare gli accessi staff.'));
        setStaffState('error');
      });

    return () => controller.abort();
  }, [canManage]);

  useEffect(() => {
    const controller = new AbortController();
    const query = debouncedStaffQuery.trim();

    if (!canManage || !query) {
      setStaffCandidates([]);
      setStaffSearchState('idle');
      return () => controller.abort();
    }

    setStaffSearchState('loading');

    fetchAdminJson<{ items: AdminUserListItem[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((payload) => {
        setStaffCandidates(payload.items);
        setStaffSearchState('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(
          humanizeErrorMessage(err, 'Non siamo riusciti a cercare gli utenti richiesti.')
        );
        setStaffSearchState('error');
      });

    return () => controller.abort();
  }, [debouncedStaffQuery, canManage]);

  useEffect(() => {
    if (selectedDayKey >= monthStartDate && selectedDayKey <= monthEndDate) return;
    setSelectedDayKey(monthStartDate);
  }, [monthEndDate, monthStartDate, selectedDayKey]);

  useEffect(() => {
    if (!selectedDayKey) return;

    setSlotRepeatUntil((current) => (current && current >= selectedDayKey ? current : selectedDayKey));
    setSlotForm((current) => {
      if (current.slotId) return current;

      const nextStartTime = current.startAt.slice(11, 16) || '09:00';
      const nextEndTime = current.endAt.slice(11, 16) || '10:00';

      return {
        ...current,
        startAt: toLocalDateTime(selectedDayKey, nextStartTime),
        endAt: toLocalDateTime(selectedDayKey, nextEndTime),
      };
    });
  }, [selectedDayKey]);

  const saveSlot = async () => {
    setSavingSlot(true);
    setError(null);
    try {
      const basePayload = {
        slotId: slotForm.slotId || null,
        serviceType: slotForm.serviceType,
        serviceVariant: slotForm.serviceVariant || null,
        capacity: Number(slotForm.capacity),
        notes: slotForm.notes || null,
      };

      if (slotForm.slotId) {
        await fetchAdminJson('/api/admin/slots', {
          method: 'POST',
          body: JSON.stringify({
            ...basePayload,
            startAt: slotForm.startAt,
            endAt: slotForm.endAt,
          }),
        });
      } else {
        const startDay = slotForm.startAt.slice(0, 10) || selectedDayKey;
        const endDay = slotRepeatMode === 'PERIOD' ? slotRepeatUntil : startDay;

        if (endDay < startDay) {
          throw new Error('La data finale del periodo deve essere uguale o successiva alla data iniziale.');
        }

        const startTime = slotForm.startAt.slice(11, 16) || '09:00';
        const endTime = slotForm.endAt.slice(11, 16) || '10:00';
        const days = enumerateDateKeys(startDay, endDay);

        await Promise.all(
          days.map((dayKey) =>
            fetchAdminJson('/api/admin/slots', {
              method: 'POST',
              body: JSON.stringify({
                ...basePayload,
                slotId: null,
                startAt: toLocalDateTime(dayKey, startTime),
                endAt: toLocalDateTime(dayKey, endTime),
              }),
            })
          )
        );
      }

      setSlotForm({
        slotId: '',
        serviceType: 'ASILO',
        serviceVariant: 'HALF',
        startAt: toLocalDateTime(selectedDayKey, '09:00'),
        endAt: toLocalDateTime(selectedDayKey, '10:00'),
        capacity: 1,
        notes: '',
      });
      setSlotRepeatMode('DAY');
      setSlotRepeatUntil(selectedDayKey);
      await loadSlots();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare lo slot.'));
    } finally {
      setSavingSlot(false);
    }
  };

  const saveStaff = async () => {
    if (isSelfStaffMember) {
      setError('Non puoi modificare il tuo stesso ruolo staff.');
      return;
    }
    if (!canManageSelectedTarget) {
      setError('Solo un Admin può gestire un altro amministratore.');
      return;
    }
    setSavingStaff(true);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(staffForm),
      });
      setStaffForm({ userId: '', role: 'VIEWER' });
      setStaffQuery('');
      setStaffCandidates([]);
      await loadStaff();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare l’accesso staff.'));
    } finally {
      setSavingStaff(false);
    }
  };

  const removeStaffMember = async (member: AdminStaffMember) => {
    if (member.userId === currentUserId) {
      setError('Non puoi rimuovere il tuo stesso accesso staff.');
      return;
    }
    if (!canManageRole(member.role)) {
      setError('Solo un Admin può rimuovere un altro amministratore.');
      return;
    }

    const ok = await confirm({
      keyword: 'ELIMINA',
      title: 'Rimuovi accesso staff',
      message: `${member.fullName} non avrà più accesso al gestionale.`,
      confirmLabel: 'Rimuovi accesso',
    });
    if (!ok) return;

    setSavingStaff(true);
    setError(null);
    try {
      await fetchAdminJson(`/api/admin/users/${member.userId}/staff`, {
        method: 'PUT',
        body: JSON.stringify({ role: '' }),
      });
      if (staffForm.userId === member.userId) {
        setStaffForm({ userId: '', role: 'VIEWER' });
        setStaffQuery('');
        setStaffCandidates([]);
      }
      await loadStaff();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a rimuovere l’accesso staff.'));
    } finally {
      setSavingStaff(false);
    }
  };

  if (!canManage) {
    return <EmptyCard label="Configurazione disponibile solo per account con poteri completi." />;
  }

  const prefillNewSlot = () => {
    const nextServiceType = slotServiceType === 'ALL' ? slotForm.serviceType : slotServiceType;
    setSlotForm({
      slotId: '',
      serviceType: nextServiceType,
      serviceVariant:
        nextServiceType === 'ASILO' ? 'HALF' : nextServiceType === 'CONSULENZA' ? 'SESSION_60' : '',
      startAt: toLocalDateTime(selectedDayKey, '09:00'),
      endAt: toLocalDateTime(selectedDayKey, '10:00'),
      capacity: 1,
      notes: '',
    });
    setSlotRepeatMode('DAY');
    setSlotRepeatUntil(selectedDayKey);
  };

  const deleteSlot = async () => {
    if (!slotForm.slotId) return;

    const confirmed = await confirm({
      keyword: 'ELIMINA',
      title: 'Elimina slot',
      message: 'Lo slot verrà eliminato definitivamente.',
    });
    if (!confirmed) return;

    setDeletingSlot(true);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/slots', {
        method: 'DELETE',
        body: JSON.stringify({ slotId: slotForm.slotId }),
      });
      prefillNewSlot();
      await loadSlots();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare lo slot.'));
    } finally {
      setDeletingSlot(false);
    }
  };

  const resetBlockForm = () => {
    setBlockForm({
      blockId: '',
      startDate: selectedDayKey,
      endDate: selectedDayKey,
      scope: 'ALL',
      breeds: [],
      notes: '',
    });
    setBlockBreedInput('');
  };

  const editBlock = (block: PensioneBlockRecord) => {
    setError(null);
    setBlockForm({
      blockId: block.id,
      startDate: block.startDate,
      endDate: block.endDate,
      scope: block.scope,
      breeds: block.breeds,
      notes: block.notes ?? '',
    });
    setBlockBreedInput('');
  };

  const addBlockBreed = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBlockForm((current) =>
      current.breeds.some((breed) => breed.toLowerCase() === trimmed.toLowerCase())
        ? current
        : { ...current, breeds: [...current.breeds, trimmed] }
    );
    setBlockBreedInput('');
  };

  const removeBlockBreed = (value: string) => {
    setBlockForm((current) => ({
      ...current,
      breeds: current.breeds.filter((breed) => breed !== value),
    }));
  };

  const saveBlock = async () => {
    if (blockForm.endDate < blockForm.startDate) {
      setError('La data di fine deve essere uguale o successiva alla data di inizio.');
      return;
    }
    if (blockForm.scope === 'BREEDS' && blockForm.breeds.length === 0) {
      setError('Seleziona almeno una razza da bloccare oppure scegli “Tutti”.');
      return;
    }

    setSavingBlock(true);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/pensione-blocks', {
        method: 'POST',
        body: JSON.stringify({
          blockId: blockForm.blockId || null,
          startDate: blockForm.startDate,
          endDate: blockForm.endDate,
          scope: blockForm.scope,
          breeds: blockForm.breeds,
          notes: blockForm.notes || null,
        }),
      });
      resetBlockForm();
      await loadBlocks();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a salvare il blocco pensione.'));
    } finally {
      setSavingBlock(false);
    }
  };

  const deleteBlock = async () => {
    if (!blockForm.blockId) return;
    const confirmed = await confirm({
      keyword: 'ELIMINA',
      title: 'Elimina blocco',
      message: 'Il blocco verrà rimosso e le date torneranno prenotabili.',
    });
    if (!confirmed) return;

    setDeletingBlock(true);
    setError(null);
    try {
      await fetchAdminJson('/api/admin/pensione-blocks', {
        method: 'DELETE',
        body: JSON.stringify({ blockId: blockForm.blockId }),
      });
      resetBlockForm();
      await loadBlocks();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a eliminare il blocco pensione.'));
    } finally {
      setDeletingBlock(false);
    }
  };

  const blockCalendarItems = blocks.map((block) => ({
    id: block.id,
    startAtIso: `${block.startDate}T00:00:00`,
    endAtIso: `${block.endDate}T00:00:00`,
    label: block.scope === 'ALL' ? 'Pensione chiusa' : `Pensione chiusa (${block.breeds.join(', ')})`,
    colorClass: '',
  }));

  return (
    <div className="admin-blocks space-y-4">
      {error ? <div className="ui-error">{error}</div> : null}

      {canManage ? (
      <Card>
        <CardContent className="space-y-3">
          <SectionHeader
            title="Staff gestionale"
            subtitle={
              canManageStaff
                ? 'Assegna ruolo: Admin, Poteri completi o Sola lettura.'
                : 'Puoi aggiungere o rimuovere solo membri in Sola lettura. Gli amministratori li gestisce un Admin.'
            }
          />
          <div ref={staffEditorRef} className="grid gap-3 scroll-mt-24">
            <input
              ref={staffSearchInputRef}
              value={staffQuery}
              onChange={(event) => setStaffQuery(event.target.value)}
              className="ui-control ui-input"
              placeholder="Cerca per nome, cognome, email o cane..."
              disabled={!canManage || savingStaff}
            />
            {selectedStaffCandidate ? (
              <div className="ui-panelInset p-3">
                <div className="ui-body font-[var(--font-weight-semibold)]">
                  {selectedExistingStaffMember ? 'Modifica ruolo staff' : 'Nuovo accesso staff'}
                </div>
                <div className="ui-body mt-1">{selectedStaffCandidate.fullName}</div>
                <div className="ui-muted">{selectedStaffCandidate.email ?? 'Email non disponibile'}</div>
                {selectedExistingStaffMember ? (
                  <div className="ui-muted mt-1">
                    Ruolo attuale: {getAdminRoleLabel(selectedExistingStaffMember.role)}
                  </div>
                ) : null}
              </div>
            ) : null}
            {staffSearchState === 'loading' ? <div className="ui-muted">Ricerca utenti…</div> : null}
            {staffQuery.trim() && staffSearchState === 'ready' ? (
              staffCandidates.length ? (
                <div className="space-y-2">
                  {staffCandidates.map((candidate) => (
                    <button
                      key={candidate.userId}
                      type="button"
                      className={cx('w-full text-left', staffForm.userId === candidate.userId && 'admin-selectedCard')}
                      onClick={() => {
                        setStaffForm((current) => ({ ...current, userId: candidate.userId }));
                        setStaffCandidates([candidate]);
                        setStaffSearchState('ready');
                        setStaffQuery(candidate.fullName);
                      }}
                    >
                      <Card className="admin-listCard">
                        <CardContent className="space-y-1">
                          <div className="ui-body font-[var(--font-weight-semibold)]">{candidate.fullName}</div>
                          <div className="ui-muted">{candidate.email ?? 'Email non disponibile'}</div>
                          {candidate.dogNames.length ? <div className="ui-muted">{candidate.dogNames.join(', ')}</div> : null}
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="ui-muted">Nessun utente trovato.</div>
              )
            ) : null}
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <select
                value={staffForm.role}
                onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value as StaffRole }))}
                className="ui-control ui-select"
                disabled={!canManage || savingStaff || !canManageSelectedTarget}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button disabled={savingStaff || !staffForm.userId || !canManageSelectedTarget} onClick={saveStaff}>
                {savingStaff
                  ? 'Salvataggio...'
                  : selectedExistingStaffMember
                    ? 'Aggiorna ruolo staff'
                    : 'Salva ruolo staff'}
              </Button>
            </div>
            {isSelfStaffMember ? (
              <div className="ui-muted">Non puoi modificare il tuo stesso ruolo staff.</div>
            ) : !canManageSelectedTarget ? (
              <div className="ui-muted">Solo un Admin può gestire questo amministratore.</div>
            ) : null}

            {staffState === 'loading' || staffState === 'idle' ? <LoadingCard label="Caricamento staff..." /> : null}
            {staffState === 'ready' && staff.length ? (
              <div className="space-y-3">
                {staff.map((member) => (
                  <Card key={member.userId} className="admin-listCard">
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <div className="space-y-1">
                          <div className="ui-body font-[var(--font-weight-semibold)]">{member.fullName}</div>
                          {member.email ? <div className="ui-muted">{member.email}</div> : null}
                          <div className="ui-muted">{getAdminRoleLabel(member.role)}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {member.userId !== currentUserId && canManageRole(member.role) ? (
                        <Button
                          variant="secondary"
                          className="ui-btnCompact"
                          onClick={() => editStaffMember(member)}
                        >
                          Modifica
                        </Button>
                        ) : null}
                        {member.userId !== currentUserId && canManageRole(member.role) ? (
                          <Button
                            variant="danger"
                            className="ui-btnCompact"
                            disabled={savingStaff}
                            onClick={() => void removeStaffMember(member)}
                          >
                            Rimuovi accesso
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4">
          <SectionHeader title="Calendario slot" subtitle="Tocca un giorno del calendario per vedere gli slot aggregati e crearne di nuovi sulla destra." />

          <div className="flex flex-wrap gap-3">
            <select
              value={slotServiceType}
              onChange={(event) => setSlotServiceType(event.target.value as ServiceType | 'ALL')}
              className="ui-control ui-select"
            >
              <option value="ALL">Tutti i servizi</option>
              <option value="ASILO">Asilo</option>
              <option value="ADDESTRAMENTO">Addestramento</option>
              <option value="CONSULENZA">Consulenza</option>
              <option value="PENSIONE">Pensione</option>
            </select>
            <Button variant="secondary" onClick={loadSlots}>
              Aggiorna calendario
            </Button>
            <div className="ui-panelInset px-3 py-2">
              <div className="ui-muted">Mese</div>
              <div className="ui-body mt-1 capitalize">
                {monthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div className="ui-panelInset px-3 py-2">
              <div className="ui-muted">Giorno selezionato</div>
              <div className="ui-body mt-1">{formatDateTime(selectedDayKey)}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <MonthCalendar
                monthDate={monthDate}
                items={slotCalendarItems}
                selectedDayKey={selectedDayKey}
                onSelectDay={setSelectedDayKey}
                onPrevMonth={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                onNextMonth={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              />

              {slotsState === 'loading' || slotsState === 'idle' ? <LoadingCard label="Caricamento slot..." /> : null}
              {slotsState === 'error' ? <ErrorCard error={error ?? 'Errore slot.'} onRetry={loadSlots} /> : null}

              <Card>
                <CardContent className="space-y-3">
                  <SectionHeader
                    title={`Slot del ${formatDateTime(selectedDayKey)}`}
                    subtitle="Le card sommano gli slot dello stesso servizio. Ogni fascia oraria resta modificabile."
                    action={
                      <Button variant="secondary" onClick={prefillNewSlot}>
                        Nuovo slot
                      </Button>
                    }
                  />

                  {slotsState === 'ready' && selectedDaySlotGroups.length ? (
                    <div className="space-y-3">
                      {selectedDaySlotGroups.map((group) => (
                        <Card key={group.key} className="admin-listCard">
                          <CardContent className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="ui-body font-[var(--font-weight-semibold)]">{group.label}</div>
                                <div className="ui-muted">
                                  {group.slots.length} {group.slots.length === 1 ? 'fascia' : 'fasce'} orarie
                                </div>
                              </div>
                              <span className="ui-accentPill">
                                {group.bookedCount}/{group.capacity}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {group.slots.map((slot) => (
                                <button
                                  key={slot.id}
                                  type="button"
                                  className="ui-accentPill"
                                  onClick={() => {
                                    setSlotForm({
                                      slotId: slot.id,
                                      serviceType: slot.serviceType,
                                      serviceVariant: slot.serviceVariant ?? '',
                                      startAt: slot.startAt.slice(0, 16),
                                      endAt: slot.endAt.slice(0, 16),
                                      capacity: slot.capacity,
                                      notes: slot.notes ?? '',
                                    });
                                    setSlotRepeatMode('DAY');
                                    setSlotRepeatUntil(slot.startAt.slice(0, 10));
                                  }}
                                >
                                  {formatTimeOnly(slot.startAt)} - {formatTimeOnly(slot.endAt)} · {slot.bookedCount}/{slot.capacity}
                                </button>
                              ))}
                            </div>

                            {group.slots.some((slot) => slot.notes) ? (
                              <div className="ui-muted">
                                {group.slots
                                  .map((slot) => slot.notes?.trim())
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : slotsState === 'ready' ? (
                    <EmptyCard label="Nessuno slot nel giorno selezionato." />
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="space-y-4">
                <SectionHeader
                  title={slotForm.slotId ? 'Modifica slot' : 'Aggiungi slot'}
                  subtitle={
                    slotForm.slotId
                      ? 'Stai modificando una singola fascia oraria esistente.'
                      : 'Il giorno selezionato imposta la data iniziale del nuovo slot.'
                  }
                  action={
                    slotForm.slotId ? (
                      <Button variant="secondary" onClick={prefillNewSlot}>
                        Nuovo slot
                      </Button>
                    ) : undefined
                  }
                />

                <div className="ui-panelInset p-3">
                  <div className="ui-muted">Data iniziale</div>
                  <div className="ui-body mt-1">{formatDateTime(slotForm.startAt.slice(0, 10) || selectedDayKey)}</div>
                </div>

                {!slotForm.slotId ? (
                  <div className="space-y-2">
                    <label className="ui-label">Creazione</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cx('admin-tabButton', slotRepeatMode === 'DAY' && 'admin-tabButton--active')}
                        onClick={() => {
                          setSlotRepeatMode('DAY');
                          setSlotRepeatUntil(slotForm.startAt.slice(0, 10) || selectedDayKey);
                        }}
                      >
                        Giorno singolo
                      </button>
                      <button
                        type="button"
                        className={cx('admin-tabButton', slotRepeatMode === 'PERIOD' && 'admin-tabButton--active')}
                        onClick={() => {
                          setSlotRepeatMode('PERIOD');
                          setSlotRepeatUntil(slotRepeatUntil < selectedDayKey ? selectedDayKey : slotRepeatUntil);
                        }}
                      >
                        Periodo
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={slotForm.serviceType}
                    onChange={(event) =>
                      setSlotForm((current) => ({ ...current, serviceType: event.target.value as ServiceType }))
                    }
                    className="ui-control ui-select"
                    disabled={!canManage || savingSlot || deletingSlot}
                  >
                    <option value="ASILO">Asilo</option>
                    <option value="ADDESTRAMENTO">Addestramento</option>
                    <option value="CONSULENZA">Consulenza</option>
                    <option value="PENSIONE">Pensione</option>
                  </select>
                  <select
                    value={slotForm.serviceVariant}
                    onChange={(event) =>
                      setSlotForm((current) => ({ ...current, serviceVariant: event.target.value as ServiceVariant | '' }))
                    }
                    className="ui-control ui-select"
                    disabled={!canManage || savingSlot || deletingSlot}
                  >
                    <option value="">Nessuna variante</option>
                    <option value="HALF">Half</option>
                    <option value="FULL">Full</option>
                    <option value="SESSION_60">Session 60</option>
                  </select>
                  <div className="space-y-1">
                    <label className="ui-label">Ora inizio</label>
                    <input
                      type="time"
                      value={slotForm.startAt.slice(11, 16)}
                      onChange={(event) =>
                        setSlotForm((current) => ({
                          ...current,
                          startAt: toLocalDateTime(current.startAt.slice(0, 10) || selectedDayKey, event.target.value),
                        }))
                      }
                      className="ui-control ui-input"
                      disabled={!canManage || savingSlot || deletingSlot}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="ui-label">Ora fine</label>
                    <input
                      type="time"
                      value={slotForm.endAt.slice(11, 16)}
                      onChange={(event) =>
                        setSlotForm((current) => ({
                          ...current,
                          endAt: toLocalDateTime(current.endAt.slice(0, 10) || selectedDayKey, event.target.value),
                        }))
                      }
                      className="ui-control ui-input"
                      disabled={!canManage || savingSlot || deletingSlot}
                    />
                  </div>
                  {!slotForm.slotId && slotRepeatMode === 'PERIOD' ? (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="ui-label">Ripeti fino al</label>
                      <input
                        type="date"
                        value={slotRepeatUntil}
                        min={slotForm.startAt.slice(0, 10) || selectedDayKey}
                        onChange={(event) => setSlotRepeatUntil(event.target.value)}
                        className="ui-control ui-input"
                        disabled={!canManage || savingSlot || deletingSlot}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <label className="ui-label">Capienza</label>
                    <input
                      type="number"
                      min={1}
                      value={slotForm.capacity}
                      onChange={(event) =>
                        setSlotForm((current) => ({ ...current, capacity: Number(event.target.value) }))
                      }
                      className="ui-control ui-input"
                      disabled={!canManage || savingSlot || deletingSlot}
                    />
                  </div>
                  <textarea
                    value={slotForm.notes}
                    onChange={(event) => setSlotForm((current) => ({ ...current, notes: event.target.value }))}
                    className="ui-control ui-textarea sm:col-span-2"
                    placeholder="Note slot"
                    disabled={!canManage || savingSlot || deletingSlot}
                  />
                  {slotForm.slotId ? (
                    <Button
                      variant="danger"
                      className="sm:col-span-2"
                      disabled={savingSlot || deletingSlot}
                      onClick={deleteSlot}
                    >
                      {deletingSlot ? 'Eliminazione...' : 'Elimina slot'}
                    </Button>
                  ) : null}
                  <Button className="sm:col-span-2" disabled={savingSlot || deletingSlot} onClick={saveSlot}>
                    {savingSlot
                      ? 'Salvataggio...'
                      : slotForm.slotId
                        ? 'Salva modifica slot'
                        : slotRepeatMode === 'PERIOD'
                          ? 'Crea slot nel periodo'
                          : 'Crea slot'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <SectionHeader
            title="Blocco prenotazioni pensione"
            subtitle="Chiudi le prenotazioni pensione per un periodo, per tutti i clienti oppure solo per alcune razze. Se un cliente ha anche un solo cane di razza bloccata, non potrà prenotare per nessuno dei suoi cani in quel periodo."
          />

          {blocksState === 'loading' ? (
            <LoadingCard label="Carico i blocchi pensione..." />
          ) : blocksState === 'error' ? (
            <ErrorCard error="Non siamo riusciti a caricare i blocchi pensione." onRetry={loadBlocks} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <MonthCalendar
                  monthDate={monthDate}
                  items={blockCalendarItems}
                  selectedDayKey={selectedDayKey}
                  onSelectDay={setSelectedDayKey}
                  onPrevMonth={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  onNextMonth={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                />

                <Card>
                  <CardContent className="space-y-2">
                    <SectionHeader
                      title={`Blocchi attivi il ${formatDateTime(selectedDayKey)}`}
                      subtitle="Tocca un blocco per modificarlo o eliminarlo."
                    />
                    {blocks.filter(
                      (block) => block.startDate <= selectedDayKey && block.endDate >= selectedDayKey
                    ).length === 0 ? (
                      <EmptyCard label="Nessun blocco attivo in questo giorno." />
                    ) : (
                      <div className="space-y-2">
                        {blocks
                          .filter((block) => block.startDate <= selectedDayKey && block.endDate >= selectedDayKey)
                          .map((block) => (
                            <button
                              key={block.id}
                              type="button"
                              className={cx('ui-selectCard w-full text-left', blockForm.blockId === block.id && 'ui-selectCard--selected')}
                              onClick={() => editBlock(block)}
                            >
                              <div className="ui-body font-[var(--font-weight-semibold)]">
                                {formatDateTime(block.startDate)} → {formatDateTime(block.endDate)}
                              </div>
                              <div className="ui-muted mt-1">
                                {block.scope === 'ALL' ? 'Tutti i clienti' : `Razze: ${block.breeds.join(', ')}`}
                              </div>
                              {block.notes ? <div className="ui-muted mt-1">{block.notes}</div> : null}
                            </button>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="space-y-3">
                  <SectionHeader
                    title={blockForm.blockId ? 'Modifica blocco' : 'Aggiungi blocco'}
                    subtitle="Seleziona il periodo e scegli se bloccare tutti i clienti o solo alcune razze."
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Dal">
                      <input
                        type="date"
                        value={blockForm.startDate}
                        onChange={(event) =>
                          setBlockForm((current) => ({
                            ...current,
                            startDate: event.target.value,
                            endDate: current.endDate < event.target.value ? event.target.value : current.endDate,
                          }))
                        }
                        className="ui-control ui-input"
                        disabled={savingBlock || deletingBlock}
                      />
                    </Field>
                    <Field label="Al">
                      <input
                        type="date"
                        value={blockForm.endDate}
                        min={blockForm.startDate}
                        onChange={(event) =>
                          setBlockForm((current) => ({ ...current, endDate: event.target.value }))
                        }
                        className="ui-control ui-input"
                        disabled={savingBlock || deletingBlock}
                      />
                    </Field>
                  </div>

                  <div className="space-y-2">
                    <label className="ui-label">Cosa bloccare</label>
                    <div className="admin-choiceGrid">
                      <button
                        type="button"
                        className={cx('admin-tabButton admin-choiceButton', blockForm.scope === 'ALL' && 'admin-tabButton--active')}
                        onClick={() => setBlockForm((current) => ({ ...current, scope: 'ALL' }))}
                        disabled={savingBlock || deletingBlock}
                      >
                        Tutti
                      </button>
                      <button
                        type="button"
                        className={cx('admin-tabButton admin-choiceButton', blockForm.scope === 'BREEDS' && 'admin-tabButton--active')}
                        onClick={() => setBlockForm((current) => ({ ...current, scope: 'BREEDS' }))}
                        disabled={savingBlock || deletingBlock}
                      >
                        Per razze
                      </button>
                    </div>
                  </div>

                  {blockForm.scope === 'BREEDS' ? (
                    <div className="space-y-2">
                      <label className="ui-label">Razze da bloccare</label>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <BreedCombobox
                            value={blockBreedInput}
                            onChange={(next, meta) => {
                              if (meta) {
                                addBlockBreed(meta.name);
                              } else {
                                setBlockBreedInput(next);
                              }
                            }}
                            placeholder="Cerca o scrivi una razza..."
                            disabled={savingBlock || deletingBlock}
                          />
                        </div>
                        <Button
                          variant="secondary"
                          className="ui-btnCompact shrink-0"
                          onClick={() => addBlockBreed(blockBreedInput)}
                          disabled={!blockBreedInput.trim() || savingBlock || deletingBlock}
                        >
                          Aggiungi
                        </Button>
                      </div>
                      {blockForm.breeds.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {blockForm.breeds.map((breed) => (
                            <button
                              key={breed}
                              type="button"
                              className="ui-accentPill"
                              onClick={() => removeBlockBreed(breed)}
                              disabled={savingBlock || deletingBlock}
                              title="Rimuovi razza"
                            >
                              {breed} ✕
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="ui-muted">Aggiungi almeno una razza.</div>
                      )}
                    </div>
                  ) : null}

                  <Field label="Note (facoltative)">
                    <input
                      type="text"
                      value={blockForm.notes}
                      onChange={(event) => setBlockForm((current) => ({ ...current, notes: event.target.value }))}
                      className="ui-control ui-input"
                      placeholder="Es. struttura al completo, ferie..."
                      disabled={savingBlock || deletingBlock}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {blockForm.blockId ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={resetBlockForm}
                          disabled={savingBlock || deletingBlock}
                        >
                          Nuovo blocco
                        </Button>
                        <Button
                          variant="danger"
                          onClick={deleteBlock}
                          disabled={savingBlock || deletingBlock}
                        >
                          {deletingBlock ? 'Eliminazione...' : 'Elimina blocco'}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      className="sm:col-span-2"
                      onClick={saveBlock}
                      disabled={savingBlock || deletingBlock}
                    >
                      {savingBlock ? 'Salvataggio...' : blockForm.blockId ? 'Salva modifica blocco' : 'Crea blocco'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
