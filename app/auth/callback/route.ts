// FILE: app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAuthRedirectBaseFromRequest } from '@/lib/auth/getAuthRedirectBase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    if (userErr || !user) {
      return NextResponse.redirect(new URL('/login?reason=confirmation_link_used_or_expired', redirectBase));
    }

    // ✅ CREA profilo SOLO DOPO conferma email (qui)
    const { data: existing } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from('profiles').insert({
        user_id: user.id,
        email: user.email ?? null,
      });
    }

    return response;
  } catch (e) {
    console.error('[auth callback route] error:', e);
    if (isUsedOrExpiredLinkError(e)) {
      return NextResponse.redirect(new URL('/login?reason=confirmation_link_used_or_expired', redirectBase));
    }
    return NextResponse.redirect(new URL('/login?e=callback_failed', redirectBase));
  }
}
