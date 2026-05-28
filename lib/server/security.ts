const DEFAULT_WRITE_WINDOW_MS = 60_000;
const DEFAULT_WRITE_LIMIT = 120;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type SecurityCheckResult = {
  status: number;
  message: string;
  retryAfterMs?: number;
};

type RateLimitArgs = {
  request: Request;
  namespace: string;
  identifier?: string | null;
  limit?: number;
  windowMs?: number;
};

// In-memory rate limiter: works correctly on single-instance deployments.
// On serverless platforms (Vercel, etc.) each cold-start gets its own counter,
// so limits are per-instance rather than global. This still throttles
// individual clients that hit the same instance, but a determined attacker
// can bypass it by spreading requests across instances.
//
// To upgrade to a distributed rate limiter:
//   npm install @upstash/ratelimit @upstash/redis
//   Replace checkRateLimit() with Upstash's sliding-window algorithm.
//   Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.
const buckets = new Map<string, RateLimitBucket>();

let _cachedEnvOrigins: Set<string> | null = null;

function getTrustedEnvOrigins(): Set<string> {
  if (_cachedEnvOrigins) return _cachedEnvOrigins;
  _cachedEnvOrigins = new Set([
    ...splitOrigins(process.env.NEXT_PUBLIC_SITE_URL),
    ...splitOrigins(process.env.NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL),
    ...splitOrigins(process.env.ALLOWED_ORIGINS),
  ]);
  return _cachedEnvOrigins;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function splitOrigins(value: string | null | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((part) => normalizeOrigin(part))
    .filter((origin): origin is string => Boolean(origin));
}

function isWriteMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function hasBearerAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization') ?? '';
  return /^Bearer\s+\S+/i.test(authHeader);
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const firstForwarded = forwardedFor?.split(',')[0]?.trim();
  if (firstForwarded) return firstForwarded;

  return (
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    'unknown'
  );
}

export function checkTrustedOrigin(request: Request): SecurityCheckResult | null {
  if (!isWriteMethod(request.method)) return null;
  if (hasBearerAuth(request)) return null;

  const requestOrigin = normalizeOrigin(new URL(request.url).origin);
  const requestOriginHeader = normalizeOrigin(request.headers.get('origin'));
  if (!requestOriginHeader) return null;

  const trustedOrigins = new Set<string>([
    ...(requestOrigin ? [requestOrigin] : []),
    ...getTrustedEnvOrigins(),
  ]);

  if (trustedOrigins.has(requestOriginHeader)) return null;

  return {
    status: 403,
    message: 'Origine richiesta non consentita.',
  };
}

export function checkRateLimit(args: RateLimitArgs): SecurityCheckResult | null {
  const windowMs = args.windowMs ?? DEFAULT_WRITE_WINDOW_MS;
  const limit = args.limit ?? DEFAULT_WRITE_LIMIT;
  const pathname = new URL(args.request.url).pathname;
  const identifier = args.identifier?.trim() || getClientIp(args.request);
  const key = `${args.namespace}:${identifier}:${args.request.method}:${pathname}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    cleanupExpiredBuckets(now);
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  return {
    status: 429,
    message: 'Troppe richieste. Riprova tra poco.',
    retryAfterMs: Math.max(0, current.resetAt - now),
  };
}

export function checkDefaultWriteRateLimit(
  request: Request,
  identifier?: string | null
): SecurityCheckResult | null {
  if (!isWriteMethod(request.method)) return null;

  return checkRateLimit({
    request,
    identifier,
    namespace: 'write',
    limit: DEFAULT_WRITE_LIMIT,
    windowMs: DEFAULT_WRITE_WINDOW_MS,
  });
}

function cleanupExpiredBuckets(now: number): void {
  if (buckets.size < 1_000) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
