'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthError, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setUser(session?.user ?? null);
        setError(sessionError ?? null);
        setLoading(false);

        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        setUser(currentUser ?? session?.user ?? null);
        setError(authError ?? sessionError ?? null);
      } catch (err) {
        if (!mounted) return;

        setUser(null);
        setError(err as AuthError);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      setError(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
    }),
    [error, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuthContext deve essere usato dentro AuthProvider.');
  }

  return value;
}
