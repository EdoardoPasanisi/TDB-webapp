// FILE: app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAuthRedirectBaseFromRequest } from '@/lib/auth/getAuthRedirectBase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function resolveSafeNextPath(url: URL): string {
  const next = url.searchParams.get('next');
  if (!next) return '/';
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  return next;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'string') return error.toLowerCase();
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message.toLowerCase();
  }
  return '';
}

function isUsedOrExpiredLinkError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  return (
    message.includes('expired') ||
    message.includes('invalid') ||
    message.includes('already') ||
    message.includes('flow state') ||
    message.includes('otp') ||
    message.includes('code verifier')
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirectBase = getAuthRedirectBaseFromRequest(request.url);
  const redirectPath = resolveSafeNextPath(url);
  const response = NextResponse.redirect(new URL(redirectPath, redirectBase));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const code = url.searchParams.get('code');

  try {
    // PKCE flow: ?code=...
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      // fallback token_hash flow (alcuni template)
      const token_hash = url.searchParams.get('token_hash');
      const type = url.searchParams.get('type') as
        | 'signup'
        | 'recovery'
        | 'invite'
        | 'magiclink'
        | 'email_change'
        | null;

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (error) throw error;
      }
    }

    // ora utente deve esistere
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    // PKCE code verifier può mancare se il link è aperto in un browser diverso.
    // In quel caso getUser() fallisce ma l'email è già confermata: usiamo la sessione.
    const resolvedUser = user ?? (await supabase.auth.getSession()).data.session?.user ?? null;

    if (!resolvedUser) {
      return NextResponse.redirect(new URL('/login?reason=confirmation_link_used_or_expired', redirectBase));
    }

    // Il profilo viene creato automaticamente dal trigger DB `on_auth_user_created`
    // su auth.users (vedi supabase/legacy_migrations/20260608_auto_create_profile_on_signup.sql),
    // quindi qui non serve più crearlo: esiste sempre, anche se questo callback fallisce.
    return response;
  } catch (e) {
    console.error('[auth callback route] error:', e);
    // Se il PKCE fallisce ma esiste già una sessione valida, redirect a success.
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    if (session) return response;
    if (isUsedOrExpiredLinkError(e)) {
      return NextResponse.redirect(new URL('/login?reason=confirmation_link_used_or_expired', redirectBase));
    }
    return NextResponse.redirect(new URL('/login?e=callback_failed', redirectBase));
  }
}
