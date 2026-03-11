'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { supabase } from '@/lib/supabaseClient';

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

  const onCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast('Link copiato!');
    } catch {
      showToast('Impossibile copiare. Seleziona e copia manualmente.');
    }
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
      const wrapper = qrWrapperRef.current;
      const svg = wrapper?.querySelector('svg');

      // Se possibile, condividiamo il FILE PNG (migliore UX)
      if (svg && navigator.share) {
        const blob = await svgToPngBlob(svg, 600);
        const file = new File([blob], 'qr-cane.png', { type: 'image/png' });

        const canShareFiles = (navigator as any).canShare ? (navigator as any).canShare({ files: [file] }) : false;

        if (canShareFiles) {
          await navigator.share({
            title: 'QR Code scheda cane',
            text: 'Ecco il QR Code della scheda del cane.',
            files: [file],
          });
          return;
        }
      }

      // Fallback: condividiamo il link
      if (navigator.share) {
        await navigator.share({
          title: 'Scheda cane',
          text: 'Link scheda pubblica cane',
          url: publicUrl,
        });
        return;
      }

      // Ultimo fallback: copia link
      await onCopyLink();
    } catch (e) {
      console.error(e);
      showToast('Condivisione annullata o non disponibile.');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <p className="text-sm text-gray-700">Generazione QR code...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold">Errore</h1>
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Indietro
          </button>
        </div>
      </main>
    );
  }

  if (!publicId || !publicUrl) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <p className="text-sm text-gray-700">QR code non disponibile.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-gray-900 print:bg-white">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="bg-white rounded-lg shadow p-4 print:shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">QR Code Scheda Cane</h1>
              <p className="text-xs text-gray-600">Scansiona per aprire la scheda pubblica del cane.</p>
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="print:hidden px-3 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
            >
              Indietro
            </button>
          </div>
        </header>

        {toast && <div className="print:hidden bg-black text-white text-xs px-3 py-2 rounded w-fit">{toast}</div>}

        <section className="bg-white rounded-lg shadow p-6 flex flex-col items-center gap-4 print:shadow-none">
          <div ref={qrWrapperRef} className="p-3 bg-white rounded">
            <QRCode value={publicUrl} size={svgSize} />
          </div>

          <div className="print:hidden w-full flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void onCopyLink()}
              disabled={!hasUrl}
              className="flex-1 px-4 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              Copia link
            </button>

            <button
              type="button"
              onClick={() => void onDownload()}
              className="flex-1 px-4 py-2 rounded bg-black text-white text-sm font-medium hover:opacity-90"
            >
              Scarica
            </button>

            <button
              type="button"
              onClick={() => void onShare()}
              disabled={!hasUrl}
              className="flex-1 px-4 py-2 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
            >
              Condividi
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
