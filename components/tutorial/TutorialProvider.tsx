'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/lib/auth/AuthProvider';
import { hasCompletedTutorial, markTutorialCompleted } from '@/lib/tutorial/tutorialApi';
import { TUTORIAL_STEPS } from './tutorialSteps';
import { TutorialOverlay } from './TutorialOverlay';

type TutorialContextValue = {
  /** Avvia (o riavvia) il tutorial dall'inizio. */
  start: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContext();
  const pathname = usePathname() || '/';

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const autoCheckedFor = useRef<string | null>(null);

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    void markTutorialCompleted();
  }, []);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= TUTORIAL_STEPS.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Auto-avvio al primo accesso (una sola volta per utente, mai in area admin).
  useEffect(() => {
    if (loading || !user) return;
    if (pathname.startsWith('/admin')) return;
    if (autoCheckedFor.current === user.id) return;
    autoCheckedFor.current = user.id;

    let cancelled = false;
    void (async () => {
      const done = await hasCompletedTutorial(user.id);
      // `null` = stato sconosciuto (errore di rete): non mostrare per sicurezza.
      if (!cancelled && done === false) {
        setIndex(0);
        setActive(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, pathname]);

  const value = useMemo<TutorialContextValue>(() => ({ start }), [start]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {active ? (
        <TutorialOverlay
          step={TUTORIAL_STEPS[index]}
          index={index}
          total={TUTORIAL_STEPS.length}
          onNext={next}
          onBack={back}
          onSkip={finish}
        />
      ) : null}
    </TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    // Fallback no-op se usato fuori dal provider (es. pagine pubbliche).
    return { start: () => {} };
  }
  return ctx;
}
