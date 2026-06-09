'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TutorialScene } from './TutorialScene';
import type { TutorialStep } from './tutorialSteps';

type Rect = { top: number; left: number; width: number; height: number };

const SPOT_PADDING = 8;

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    if (!step.spot) {
      setRect(null);
      return;
    }
    const container = sceneRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-spot="${step.spot}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step.spot]);

  // Centra l'elemento e misura quando cambia lo step.
  useLayoutEffect(() => {
    setRect(null);
    if (!step.spot) return;

    let raf = 0;
    let tries = 0;

    const run = () => {
      const container = sceneRef.current;
      const el = container?.querySelector<HTMLElement>(`[data-spot="${step.spot}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
        measure();
        return;
      }
      if (tries++ < 10) raf = requestAnimationFrame(run);
    };

    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [step.id, step.spot, measure]);

  // Riallinea lo spotlight su scroll/resize.
  useEffect(() => {
    if (!step.spot) return;
    const container = sceneRef.current;
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    container?.addEventListener('scroll', onChange, { passive: true });
    return () => {
      window.removeEventListener('resize', onChange);
      container?.removeEventListener('scroll', onChange);
    };
  }, [step.spot, measure]);

  // Blocca lo scroll della pagina sottostante + tastiera.
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

  return createPortal(
    <div className="tut-root" role="dialog" aria-modal="true" aria-label="Tutorial">
      {/* Scena mock scorribile (sfondo) */}
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

      {/* Tooltip */}
      <div className="tut-card">
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
