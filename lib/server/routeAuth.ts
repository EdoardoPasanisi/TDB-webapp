import { NextResponse } from 'next/server';
import { createClient, type User, type SupabaseClient } from '@supabase/supabase-js';
import { missingEnvClient } from '@/lib/supabaseUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerSupabaseClient } from '@/lib/server/supabaseServer';
import {
  checkDefaultWriteRateLimit,
  checkTrustedOrigin,
} from '@/lib/server/security';

export type RouteAuthUser = {
  userId: string;
  email: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export class RouteAuthError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function routeAuthErrorResponse(error: RouteAuthError, body: Record<string, string>) {
  const response = NextResponse.json(body, { status: error.status });
  if (error.status === 429 && error.retryAfterMs != null) {
    response.headers.set('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
  }
  return response;
}

export function readBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') ?? '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  return tokenMatch?.[1] ?? null;
}


function isVerifiedUser(user: User): boolean {
  const userWithLegacyConfirmedAt = user as User & { confirmed_at?: string | null };
  return Boolean(user.email_confirmed_at ?? userWithLegacyConfirmedAt.confirmed_at);
}

function toRouteAuthUser(user: User): RouteAuthUser {
  if (!isVerifiedUser(user)) {
    throw new RouteAuthError(403, 'Email non verificata.');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
  };
}

export async function requireBearerUser(request: Request): Promise<RouteAuthUser> {
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    throw new RouteAuthError(401, 'Non autorizzato.');
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    throw new RouteAuthError(401, 'Sessione non valida.');
  }

  const routeUser = toRouteAuthUser(userData.user);
  const rateLimitError = checkDefaultWriteRateLimit(request, routeUser.userId);
  if (rateLimitError) {
    throw new RouteAuthError(rateLimitError.status, rateLimitError.message, rateLimitError.retryAfterMs);
  }

  return routeUser;
}

export async function requireRequestUser(request: Request): Promise<RouteAuthUser> {
  const originError = checkTrustedOrigin(request);
  if (originError) {
    throw new RouteAuthError(originError.status, originError.message);
  }

  const accessToken = readBearerToken(request);
  if (accessToken) {
    return requireBearerUser(request);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new RouteAuthError(401, 'Non autorizzato.');
  }

  const routeUser = toRouteAuthUser(user);
  const rateLimitError = checkDefaultWriteRateLimit(request, routeUser.userId);
  if (rateLimitError) {
    throw new RouteAuthError(rateLimitError.status, rateLimitError.message, rateLimitError.retryAfterMs);
  }

  return routeUser;
}

export async function createRequestSupabaseClient(request: Request): Promise<SupabaseClient> {
  const accessToken = readBearerToken(request);
  if (accessToken) {
    if (!supabaseUrl || !supabaseAnonKey) {
      return missingEnvClient(
        'Supabase non configurato: mancano NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
      );
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  return createServerSupabaseClient();
}
