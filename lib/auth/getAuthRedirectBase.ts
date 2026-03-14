const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

function normalizeHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return lower.slice(1, -1);
  }
  return lower;
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(normalizeHostname(hostname));
}

export function getAuthRedirectBase(): string {
  if (typeof window !== 'undefined') {
    const runtimeUrl = new URL(window.location.origin);
    if (!isLocalHostname(runtimeUrl.hostname)) {
      return normalizeBase(runtimeUrl.origin);
    }
  }

  const configuredBase = process.env.NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL;
  if (configuredBase?.trim()) {
    return normalizeBase(configuredBase);
  }

  if (typeof window === 'undefined') return '';
  return normalizeBase(window.location.origin);
}

export function getAuthRedirectBaseFromRequest(requestUrl: string): string {
  const url = new URL(requestUrl);
  if (!isLocalHostname(url.hostname)) {
    return `${url.protocol}//${url.host}`;
  }

  const configuredBase = process.env.NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL;
  if (configuredBase?.trim()) {
    return normalizeBase(configuredBase);
  }

  return `${url.protocol}//${url.host}`;
}
