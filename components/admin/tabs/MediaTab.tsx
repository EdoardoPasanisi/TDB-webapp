'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { CUSTOMER_MEDIA_ACCEPT } from '@/lib/media/config';
import { supabase } from '@/lib/supabaseClient';
import {
  CUSTOMER_MEDIA_MIME_TYPES,
  MAX_CUSTOMER_MEDIA_BYTES,
  validateUploadBytes,
  validateUploadFile,
} from '@/lib/validation/uploads';
import type { AdminMediaRecapItem } from '@/types/media';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  EmptyCard,
  ErrorCard,
  LoadingCard,
  cx,
  formatDateTime,
  type LoadState,
} from '@/components/admin/shared';

type MediaDraft = {
  caption: string;
  file: File | null;
};

type SignedMediaUploadResponse = {
  upload: {
    bucket: string;
    storagePath: string;
    token: string;
  };
};

async function validateMediaDraftFile(file: File): Promise<string | null> {
  const metadataError = validateUploadFile({
    file,
    allowedMimeTypes: CUSTOMER_MEDIA_MIME_TYPES,
    maxBytes: MAX_CUSTOMER_MEDIA_BYTES,
    invalidTypeMessage: 'Formato non valido. Usa JPG, PNG, WebP, MP4, MOV o WebM.',
    tooLargeMessage: 'Il media è troppo grande. Limite massimo: 50MB.',
  });

  if (metadataError) return metadataError;

  const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return validateUploadBytes(file, headerBytes);
}

function priorityTone(priority: AdminMediaRecapItem['priority']) {
  if (priority === 'URGENT') {
    return {
      label: 'Urgente',
      style: {
        borderColor: 'rgba(248, 113, 113, 0.48)',
        background: 'rgba(248, 113, 113, 0.14)',
        color: 'rgba(254, 226, 226, 0.96)',
      },
    };
  }

  if (priority === 'HIGH') {
    return {
      label: 'Alta',
      style: {
        borderColor: 'rgba(255, 130, 0, 0.48)',
        background: 'rgba(255, 130, 0, 0.14)',
        color: 'rgba(255, 219, 184, 0.96)',
      },
    };
  }

  if (priority === 'MEDIUM') {
    return {
      label: 'Media',
      style: {
        borderColor: 'rgba(59, 130, 246, 0.4)',
        background: 'rgba(59, 130, 246, 0.14)',
        color: 'rgba(219, 234, 254, 0.96)',
      },
    };
  }

  return {
    label: 'Bassa',
    style: {
      borderColor: 'rgba(34, 197, 94, 0.4)',
      background: 'rgba(34, 197, 94, 0.14)',
      color: 'rgba(220, 252, 231, 0.96)',
    },
  };
}

function formatServiceWindow(item: AdminMediaRecapItem) {
  const start = formatDateTime(item.startDate);
  const end = item.endDate ? formatDateTime(item.endDate) : 'in corso';
  return `${start} → ${end}`;
}

function formatDaysWithoutMedia(days: number) {
  if (days <= 0) return 'Oggi';
  if (days === 1) return '1 giorno';
  return `${days} giorni`;
}

export function MediaTab() {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminMediaRecapItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MediaDraft>>({});
  const [uploadingBookingId, setUploadingBookingId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState('loading');
    setError(null);
    try {
      const payload = await fetchAdminJson<{ items: AdminMediaRecapItem[] }>('/api/admin/media', { signal });
      setItems(payload.items);
      setState('ready');
    } catch (err) {
      if (isAbortError(err)) return;
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il recap media.'));
      setState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (!item.lastMediaAt) acc.withoutMedia += 1;
        if (item.priority === 'URGENT') acc.urgent += 1;
        if (item.priority === 'HIGH') acc.high += 1;
        return acc;
      },
      { total: 0, withoutMedia: 0, urgent: 0, high: 0 }
    );
  }, [items]);

  function updateDraft(bookingId: string, patch: Partial<MediaDraft>) {
    setDrafts((current) => ({
      ...current,
      [bookingId]: {
        caption: current[bookingId]?.caption ?? '',
        file: current[bookingId]?.file ?? null,
        ...patch,
      },
    }));
  }

  async function uploadForBooking(item: AdminMediaRecapItem) {
    const draft = drafts[item.bookingId];
    if (!draft?.file) {
      setError('Seleziona prima una foto o un video.');
      return;
    }

    setUploadingBookingId(item.bookingId);
    setError(null);

    try {
      const validationError = await validateMediaDraftFile(draft.file);
      if (validationError) {
        throw new Error(validationError);
      }

      const signedUpload = await fetchAdminJson<SignedMediaUploadResponse>('/api/admin/media/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: item.bookingId,
          fileName: draft.file.name,
          mimeType: draft.file.type,
          size: draft.file.size,
        }),
      });

      const { error: uploadError } = await supabase.storage
        .from(signedUpload.upload.bucket)
        .uploadToSignedUrl(signedUpload.upload.storagePath, signedUpload.upload.token, draft.file, {
          cacheControl: '31536000',
          contentType: draft.file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(humanizeErrorMessage(uploadError, 'Non siamo riusciti a caricare il media.'));
      }

      await fetchAdminJson('/api/admin/media/complete', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: item.bookingId,
          caption: draft.caption.trim(),
          storagePath: signedUpload.upload.storagePath,
          mimeType: draft.file.type,
          size: draft.file.size,
        }),
      });

      setDrafts((current) => ({
        ...current,
        [item.bookingId]: { caption: '', file: null },
      }));

      await load();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il media.'));
    } finally {
      setUploadingBookingId(null);
    }
  }

  if (state === 'loading' || state === 'idle') {
    return <LoadingCard label="Caricamento recap media..." />;
  }

  if (state === 'error') {
    return <ErrorCard error={error ?? 'Errore caricamento media.'} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <SectionHeader
            title="Media pensione"
            subtitle="Recap di foto e video inviati ai clienti durante le pensioni attive."
          />

          <div className="grid gap-3 md:grid-cols-4">
            <div className="ui-panelInset p-3">
              <div className="ui-muted">Pensioni in recap</div>
              <div className="ui-title mt-1">{totals.total}</div>
            </div>
            <div className="ui-panelInset p-3">
              <div className="ui-muted">Senza media</div>
              <div className="ui-title mt-1">{totals.withoutMedia}</div>
            </div>
            <div className="ui-panelInset p-3">
              <div className="ui-muted">Priorità urgente</div>
              <div className="ui-title mt-1">{totals.urgent}</div>
            </div>
            <div className="ui-panelInset p-3">
              <div className="ui-muted">Priorità alta</div>
              <div className="ui-title mt-1">{totals.high}</div>
            </div>
          </div>

          {error ? <div className="ui-error">{error}</div> : null}
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyCard label="Nessuna pensione attiva da monitorare per i media." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const priority = priorityTone(item.priority);
            const draft = drafts[item.bookingId] ?? { caption: '', file: null };
            const isUploading = uploadingBookingId === item.bookingId;

            return (
              <Card key={item.bookingId} className="admin-listCard overflow-hidden">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="ui-accentPill">Pensione</span>
                        <span className="ui-pill" style={priority.style}>
                          Priorità {priority.label}
                        </span>
                        {item.lastMediaType ? (
                          <span className="ui-pill">
                            Ultimo invio: {item.lastMediaType === 'VIDEO' ? 'Video' : 'Foto'}
                          </span>
                        ) : (
                          <span className="ui-pill">Nessun media inviato</span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="ui-title">{item.ownerName}</div>
                        <div className="ui-muted">
                          {item.ownerEmail || 'Email non disponibile'}
                        </div>
                      </div>
                    </div>

                    <div className="ui-panelInset p-3 min-w-[220px]">
                      <div className="ui-muted">Finestra servizio</div>
                      <div className="ui-body mt-1">{formatServiceWindow(item)}</div>
                      <div className="ui-muted mt-3">Ultimo media</div>
                      <div className="ui-body mt-1">
                        {item.lastMediaAt ? formatDateTime(item.lastMediaAt) : 'Mai inviato'}
                      </div>
                      <div className="ui-muted mt-3">Senza media da</div>
                      <div className="ui-body mt-1">{formatDaysWithoutMedia(item.daysWithoutMedia)}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1.3fr_0.9fr_0.8fr]">
                    <div className="ui-panelInset p-3">
                      <div className="ui-muted">Cani</div>
                      <div className="ui-body mt-1">
                        {item.dogNames.length ? item.dogNames.join(', ') : 'Cani non associati'}
                      </div>
                    </div>
                    <div className="ui-panelInset p-3">
                      <div className="ui-muted">Media inviati</div>
                      <div className="ui-title mt-1">{item.mediaCount}</div>
                    </div>
                    <div className="ui-panelInset p-3">
                      <div className="ui-muted">Scadenza visibilità</div>
                      <div className="ui-body mt-1">24h dopo il termine del servizio</div>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius)] border border-[rgba(255,130,0,0.22)] bg-[rgba(255,130,0,0.05)] p-3 space-y-3">
                    <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
                      <div className="space-y-2">
                        <label className="space-y-1 block">
                          <span className="ui-label">Didascalia opzionale</span>
                          <input
                            type="text"
                            value={draft.caption}
                            onChange={(event) => updateDraft(item.bookingId, { caption: event.target.value })}
                            className="ui-control ui-input"
                            placeholder="Es. Passeggiata del pomeriggio"
                          />
                        </label>

                        <label className="space-y-1 block">
                          <span className="ui-label">Foto o video</span>
                          <input
                            key={draft.file?.name ?? `${item.bookingId}-empty`}
                            type="file"
                            accept={CUSTOMER_MEDIA_ACCEPT}
                            className="ui-control ui-input file:mr-3 file:border-0 file:bg-transparent file:font-semibold file:text-[var(--brand-accent)]"
                            onChange={(event) =>
                              updateDraft(item.bookingId, {
                                file: event.target.files?.[0] ?? null,
                              })
                            }
                          />
                        </label>
                      </div>

                      <Button
                        variant="primary"
                        className={cx('w-full xl:w-auto', isUploading && 'opacity-80')}
                        disabled={isUploading || !draft.file}
                        onClick={() => void uploadForBooking(item)}
                      >
                        {isUploading ? 'Invio…' : 'Invia media'}
                      </Button>
                    </div>

                    {draft.file ? (
                      <div className="ui-fine text-[rgba(255,255,255,0.62)] break-all">
                        File selezionato: {draft.file.name}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
