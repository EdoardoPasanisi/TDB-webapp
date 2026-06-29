'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as tus from 'tus-js-client';
import { fetchAdminJson, isAbortError } from '@/lib/admin/client';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { CUSTOMER_MEDIA_ACCEPT } from '@/lib/media/config';
import { supabase } from '@/lib/supabaseClient';
import {
  CUSTOMER_MEDIA_MIME_TYPES,
  MAX_CUSTOMER_MEDIA_BYTES,
  MAX_CUSTOMER_VIDEO_BYTES,
  validateUploadBytes,
  validateUploadFile,
} from '@/lib/validation/uploads';
import type { AdminMediaRecapItem, CustomerMediaViewItem } from '@/types/media';
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

type GalleryState = {
  state: LoadState;
  items: CustomerMediaViewItem[];
  error: string | null;
};

type MediaUploadResponse = {
  upload:
    | { provider: 'supabase'; bucket: string; storagePath: string; token: string }
    | { provider: 'cloudflare_stream'; uid: string; uploadUrl: string };
};

// Cloudflare richiede chunk multipli di 256 KiB (>= 5 MB): 50 MB e un buon compromesso su mobile.
const TUS_CHUNK_SIZE = 50 * 1024 * 1024;

function isVideoFile(file: File): boolean {
  return String(file.type ?? '').toLowerCase().startsWith('video/');
}

async function validateMediaDraftFile(file: File): Promise<string | null> {
  const video = isVideoFile(file);
  const metadataError = validateUploadFile({
    file,
    allowedMimeTypes: CUSTOMER_MEDIA_MIME_TYPES,
    maxBytes: video ? MAX_CUSTOMER_VIDEO_BYTES : MAX_CUSTOMER_MEDIA_BYTES,
    invalidTypeMessage: 'Formato non valido. Usa JPG, PNG, WebP, MP4, MOV o WebM.',
    tooLargeMessage: video
      ? 'Il video è troppo grande. Limite massimo: 2GB.'
      : 'La foto è troppo grande. Limite massimo: 50MB.',
  });

  if (metadataError) return metadataError;

  const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return validateUploadBytes(file, headerBytes);
}

function uploadVideoToCloudflare(args: {
  uploadUrl: string;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(args.file, {
      uploadUrl: args.uploadUrl,
      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: args.file.name,
        filetype: args.file.type,
      },
      onError: (error) => reject(error),
      onProgress: (bytesSent, bytesTotal) => {
        if (bytesTotal > 0) {
          args.onProgress(Math.min(100, Math.round((bytesSent / bytesTotal) * 100)));
        }
      },
      onSuccess: () => resolve(),
    });

    upload.start();
  });
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function MediaPreview({ media }: { media: CustomerMediaViewItem }) {
  return (
    <div className="ui-panelInset space-y-2 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="ui-pill">{media.mediaType === 'VIDEO' ? 'Video' : 'Foto'}</span>
        <span className="ui-fine text-[rgba(255,255,255,0.56)]">{formatDateTime(media.createdAt)}</span>
      </div>

      <div className="overflow-hidden rounded-[calc(var(--radius)+2px)] border border-[rgba(255,255,255,0.08)] bg-black">
        {media.mediaType === 'VIDEO' ? (
          media.status === 'ready' && media.mediaUrl ? (
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={media.mediaUrl}
                title={media.caption || 'Video inviato'}
                loading="lazy"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-black px-4 text-center">
              <span className="ui-muted">Video in elaborazione: sarà visibile tra pochi minuti.</span>
            </div>
          )
        ) : media.mediaUrl ? (
          <img
            src={media.mediaUrl}
            alt={media.caption || 'Media inviato'}
            className="block h-auto max-h-[320px] w-full object-cover"
          />
        ) : null}
      </div>

      {media.caption ? <div className="ui-body">{media.caption}</div> : null}
      <div className="ui-fine text-[rgba(255,255,255,0.52)]">
        Visibile fino al {formatDateTime(media.visibleUntil)}
      </div>
    </div>
  );
}

export function MediaTab() {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminMediaRecapItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MediaDraft>>({});
  const [uploadingBookingId, setUploadingBookingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [galleries, setGalleries] = useState<Record<string, GalleryState>>({});

  const loadGallery = useCallback(async (bookingId: string) => {
    setGalleries((current) => ({
      ...current,
      [bookingId]: { state: 'loading', items: current[bookingId]?.items ?? [], error: null },
    }));
    try {
      const payload = await fetchAdminJson<{ items: CustomerMediaViewItem[] }>(
        `/api/admin/media/${bookingId}`
      );
      setGalleries((current) => ({
        ...current,
        [bookingId]: { state: 'ready', items: payload.items, error: null },
      }));
    } catch (err) {
      setGalleries((current) => ({
        ...current,
        [bookingId]: {
          state: 'error',
          items: current[bookingId]?.items ?? [],
          error: humanizeErrorMessage(err, 'Non siamo riusciti a caricare i media inviati.'),
        },
      }));
    }
  }, []);

  function toggleGallery(bookingId: string) {
    const willOpen = !expanded[bookingId];
    setExpanded((current) => ({ ...current, [bookingId]: willOpen }));
    if (willOpen && galleries[bookingId]?.state !== 'ready') {
      void loadGallery(bookingId);
    }
  }

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

    const file = draft.file;
    setUploadingBookingId(item.bookingId);
    setUploadProgress(null);
    setError(null);

    try {
      const validationError = await validateMediaDraftFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      const { upload } = await fetchAdminJson<MediaUploadResponse>('/api/admin/media/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: item.bookingId,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });

      const completeBody: Record<string, unknown> = {
        bookingId: item.bookingId,
        caption: draft.caption.trim(),
        mimeType: file.type,
        size: file.size,
      };

      if (upload.provider === 'cloudflare_stream') {
        setUploadProgress(0);
        await uploadVideoToCloudflare({
          uploadUrl: upload.uploadUrl,
          file,
          onProgress: setUploadProgress,
        });
        completeBody.streamUid = upload.uid;
      } else {
        const { error: uploadError } = await supabase.storage
          .from(upload.bucket)
          .uploadToSignedUrl(upload.storagePath, upload.token, file, {
            cacheControl: '31536000',
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(humanizeErrorMessage(uploadError, 'Non siamo riusciti a caricare il media.'));
        }
        completeBody.storagePath = upload.storagePath;
      }

      await fetchAdminJson('/api/admin/media/complete', {
        method: 'POST',
        body: JSON.stringify(completeBody),
      });

      setDrafts((current) => ({
        ...current,
        [item.bookingId]: { caption: '', file: null },
      }));

      if (expanded[item.bookingId]) {
        void loadGallery(item.bookingId);
      }

      await load();
    } catch (err) {
      setError(humanizeErrorMessage(err, 'Non siamo riusciti a caricare il media.'));
    } finally {
      setUploadingBookingId(null);
      setUploadProgress(null);
    }
  }

  if (state === 'loading' || state === 'idle') {
    return <LoadingCard label="Caricamento recap media..." />;
  }

  if (state === 'error') {
    return <ErrorCard error={error ?? 'Errore caricamento media.'} onRetry={() => void load()} />;
  }

  return (
    <div className="admin-blocks space-y-4">
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
            const draftIsVideo = draft.file ? isVideoFile(draft.file) : false;
            const isGalleryOpen = Boolean(expanded[item.bookingId]);
            const gallery = galleries[item.bookingId];

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

                        <div className="ui-fine text-[rgba(255,255,255,0.62)]">
                          I video vengono elaborati dopo l’invio e diventano visibili al cliente in pochi minuti.
                        </div>
                      </div>

                      <Button
                        variant="primary"
                        className={cx('w-full xl:w-auto', isUploading && 'opacity-80')}
                        disabled={isUploading || !draft.file}
                        onClick={() => void uploadForBooking(item)}
                      >
                        {isUploading
                          ? uploadProgress != null
                            ? `Invio… ${uploadProgress}%`
                            : 'Invio…'
                          : 'Invia media'}
                      </Button>
                    </div>

                    {draft.file ? (
                      <div className="ui-fine text-[rgba(255,255,255,0.62)] break-all">
                        File selezionato: {draft.file.name} ({formatFileSize(draft.file.size)})
                        {draftIsVideo ? ' · video' : ''}
                      </div>
                    ) : null}
                  </div>

                  {item.mediaCount > 0 ? (
                    <div className="space-y-3">
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => toggleGallery(item.bookingId)}
                      >
                        {isGalleryOpen
                          ? 'Nascondi media inviati'
                          : `Vedi media inviati (${item.mediaCount})`}
                      </Button>

                      {isGalleryOpen ? (
                        gallery?.state === 'loading' ? (
                          <LoadingCard label="Caricamento media inviati..." />
                        ) : gallery?.state === 'error' ? (
                          <ErrorCard
                            error={gallery.error ?? 'Errore caricamento media.'}
                            onRetry={() => void loadGallery(item.bookingId)}
                          />
                        ) : gallery && gallery.items.length === 0 ? (
                          <EmptyCard label="Nessun media ancora attivo per questa pensione (i media inviati scadono 48h dopo l'invio)." />
                        ) : gallery ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {gallery.items.map((media) => (
                              <MediaPreview key={media.id} media={media} />
                            ))}
                          </div>
                        ) : null
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
