'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { TutorialScene } from './TutorialScene';
import type { TutorialStep } from './tutorialSteps';

type Rect = { top: number; left: number; width: number; height: number };

const SPOT_PADDING = 8;

/** Restituisce l'elemento data-spot effettivamente VISIBILE (mobile o desktop), o null. */
function findVisibleSpot(container: HTMLElement, spot: string): HTMLElement | null {
  const els = Array.from(container.querySelectorAll<HTMLElement>(`[data-spot="${spot}"]`));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return el;
  }
  return null;
}

/** Centra l'elemento nella scena agendo su scrollTop (la scena ha overflow:hidden). */
function centerTargetInScene(container: HTMLElement, el: HTMLElement) {
  const cRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const elTopInContent = elRect.top - cRect.top + container.scrollTop;
  const target = elTopInContent - (container.clientHeight - elRect.height) / 2;
  container.scrollTop = Math.max(0, target);
}

export function TutorialOverlay({
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  step: TutorialStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');
  // client-only (per createPortal) senza setState in effect → SSR-safe e lint-clean
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Trova / centra (una volta) / misura l'elemento. Ri-misura di continuo finché lo
  // step è attivo: auto-correttivo contro layout tardivo, caricamento icone, sticky.
  // Ogni setState avviene dentro la callback (rAF/interval/resize), mai sincrono
  // nel corpo dell'effect.
  useLayoutEffect(() => {
    let centered = false;
    let lastKey = '';

    const measureOnce = () => {
      if (!step.spot) {
        if (lastKey !== 'none') {
          lastKey = 'none';
          setRect(null);
        }
        return;
      }
      const container = sceneRef.current;
      if (!container) return;
      const el = findVisibleSpot(container, step.spot);
      if (!el) return; // non azzerare: evita flicker mentre la scena si monta
      if (!centered) {
        centerTargetInScene(container, el);
        centered = true;
      }
      const r = el.getBoundingClientRect();
      const nextPlacement = r.top + r.height / 2 > window.innerHeight * 0.52 ? 'top' : 'bottom';
      const key = `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(
        r.height
      )}:${nextPlacement}`;
      if (key === lastKey) return; // evita re-render inutili
      lastKey = key;
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setPlacement(nextPlacement);
    };

    const raf = requestAnimationFrame(measureOnce);
    const id = window.setInterval(measureOnce, 60);
    window.addEventListener('resize', measureOnce);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
      window.removeEventListener('resize', measureOnce);
    };
  }, [step.id, step.spot]);

  // Blocca lo scroll della pagina sottostante + scorciatoie tastiera.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
      else if (e.key === 'ArrowLeft') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onNext, onBack, onSkip]);

  if (!mounted) return null;

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const cardPos = rect ? placement : 'bottom';

  return createPortal(
    <div className="tut-root" role="dialog" aria-modal="true" aria-label="Tutorial">
      {/* Scena mock (sfondo, immagine statica) */}
      <div ref={sceneRef} className="tut-scene">
        <TutorialScene scene={step.scene} />
      </div>

      {/* Velo scuro + spotlight */}
      {rect ? (
        <div
          className="tut-spot"
          style={{
            top: rect.top - SPOT_PADDING,
            left: rect.left - SPOT_PADDING,
            width: rect.width + SPOT_PADDING * 2,
            height: rect.height + SPOT_PADDING * 2,
          }}
        />
      ) : (
        <div className="tut-veil" />
      )}

      {/* Card esplicativa */}
      <div className={`tut-card tut-card--${cardPos}`}>
        {step.chip ? <div className="tut-chip">{step.chip}</div> : null}
        <h3 className="tut-title">{step.title}</h3>
        <p className="tut-body">{step.body}</p>

        <div className="tut-dots" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`tut-dot ${i === index ? 'tut-dot--on' : ''}`} />
          ))}
        </div>

        <div className="tut-actions">
          <button type="button" className="tut-skip" onClick={onSkip}>
            {isLast ? '' : 'Salta'}
          </button>
          <div className="tut-actions__right">
            {!isFirst ? (
              <button type="button" className="ui-btn ui-btnTone-secondary tut-btn" onClick={onBack}>
                Indietro
              </button>
            ) : null}
            <button type="button" className="ui-btn ui-btnTone-primary tut-btn" onClick={onNext}>
              {isLast ? 'Inizia' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
