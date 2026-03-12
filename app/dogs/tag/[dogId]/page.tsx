'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface ApiResponse {
  publicId?: string;
  error?: string;
}

function svgToPngBlob(svgEl: SVGElement, sizePx: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = sizePx;
        canvas.height = sizePx;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas non disponibile'));
          return;
        }

        // sfondo bianco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sizePx, sizePx);

        ctx.drawImage(img, 0, 0, sizePx, sizePx);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Impossibile esportare PNG'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Impossibile caricare immagine'));
      };

      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

export default function DogTagPage() {
  const router = useRouter();
  const params = useParams();
  const dogId = params?.dogId as string | undefined;

  const { user, loading: authLoading } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [publicId, setPublicId] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<string | null>(null);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      if (!user) return;

      if (!dogId) {
        setError('ID cane non valido.');
        setLoading(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          setError('Sessione non valida. Effettua di nuovo il login.');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/dog-public-id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ dogId }),
        });

        const data = (await res.json()) as ApiResponse;

        if (!res.ok || !data.publicId) {
          setError(data.error || 'Impossibile generare il QR code.');
          setLoading(false);
          return;
        }

        setPublicId(data.publicId);

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const url = `${origin}/dogs/card/${data.publicId}`;
        setPublicUrl(url);

        setLoading(false);
      } catch (err: any) {
        console.error('DogTagPage – errore:', err);
        setError(err?.message || 'Errore inatteso.');
        setLoading(false);
      }
    };

    void load();
  }, [authLoading, user, dogId]);

  const svgSize = 220;

  const hasUrl = useMemo(() => Boolean(publicUrl), [publicUrl]);

  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.body.appendChild(input);
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(input);
      return copied;
    } catch {
      return false;
    }
  };

  const onCopyLink = async () => {
    if (!publicUrl) return;
    const copied = await copyText(publicUrl);
    if (copied) {
      showToast('Link copiato!');
      setSharePanelOpen(false);
      return;
    }
    showToast('Impossibile copiare automaticamente.');
  };

  const onDownload = async () => {
    try {
      const wrapper = qrWrapperRef.current;
      const svg = wrapper?.querySelector('svg');
      if (!svg) {
        showToast('QR non disponibile.');
        return;
      }

      const blob = await svgToPngBlob(svg, 600);
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-cane.png';
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      showToast('Download avviato.');
    } catch (e) {
      console.error(e);
      showToast('Impossibile scaricare il QR.');
    }
  };

  const onShare = async () => {
    if (!publicUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Scheda cane',
          text: 'Link scheda pubblica cane',
          url: publicUrl,
        });
        return;
      }

      setSharePanelOpen(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Condivisione non disponibile, apertura pannello fallback:', e);
      setSharePanelOpen(true);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)] p-4">
        <p className="ui-body text-[var(--muted)]">Generazione QR code...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--brand-bg)] p-4">
        <div className="mx-auto w-full max-w-xl pt-8">
          <Card>
            <CardContent className="space-y-3 text-center">
              <h1 className="ui-h2">Errore</h1>
              <p className="ui-body text-[rgba(255,0,0,0.85)]">{error}</p>
              <Button type="button" variant="secondary" fullWidth onClick={() => router.back()}>
                Indietro
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!publicId || !publicUrl) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--brand-bg)] p-4">
        <p className="ui-body text-[var(--muted)]">QR code non disponibile.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--brand-bg)] p-4 text-[var(--text)] print:bg-white">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Card className="print:hidden">
          <CardContent className="space-y-3">
            <SectionHeader
              title="QR code scheda cane"
              subtitle="Scansiona per aprire la scheda pubblica del cane."
            />
          </CardContent>
        </Card>

        <Card className="print:shadow-none print:border-none print:bg-white">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-center">
              <div ref={qrWrapperRef} className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-3">
                <QRCode value={publicUrl} size={svgSize} />
              </div>
            </div>

            <div className="print:hidden grid gap-2">
              <Button type="button" variant="primary" fullWidth onClick={() => void onDownload()}>
                Scarica QR
              </Button>
              <Button type="button" variant="secondary" fullWidth disabled={!hasUrl} onClick={() => void onCopyLink()}>
                Copia link
              </Button>
              <Button type="button" variant="secondary" fullWidth disabled={!hasUrl} onClick={() => void onShare()}>
                Condividi
              </Button>
            </div>

            {sharePanelOpen ? (
              <div className="print:hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2">
                <p className="ui-body font-[var(--font-weight-semibold)]">Condividi con</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Scheda cane: ${publicUrl}`)}`, '_blank', 'noopener,noreferrer')}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent('Scheda cane')}`, '_blank', 'noopener,noreferrer')}
                  >
                    Telegram
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, '_blank', 'noopener,noreferrer')}
                  >
                    Facebook
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      window.location.href = `mailto:?subject=${encodeURIComponent('Scheda cane')}&body=${encodeURIComponent(`Scheda cane: ${publicUrl}`)}`;
                    }}
                  >
                    Email
                  </Button>
                </div>
              </div>
            ) : null}

            {toast ? (
              <div className="print:hidden rounded-[var(--radius)] border border-[rgba(114,221,139,0.55)] bg-[rgba(114,221,139,0.15)] p-3">
                <p className="ui-body text-[rgb(154,244,174)]">{toast}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
