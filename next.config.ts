import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';

// IPv4 LAN del Mac (es. 192.168.x.x o 172.20.10.x dell'hotspot iPhone). Serve in dev
// per autorizzare la WebView Capacitor che carica il dev server, senza dover hardcodare
// l'IP: cambia rete → il dev server riparte e ri-rileva l'indirizzo da solo.
function localNetworkIPs(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) out.push(addr.address);
    }
  }
  return out;
}

const scriptSrc =
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.cloudflarestream.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.cloudflarestream.com",
  // *.supabase.co serve al viewer in-app dei documenti PDF (iframe sul signed URL).
  "frame-src 'self' https://*.supabase.co https://*.cloudflarestream.com",
  // upgrade-insecure-requests è giusto in produzione (forza HTTPS) ma in dev rompe
  // il caricamento dal dev server locale in HTTP (es. WebView Capacitor → http://IP:3000).
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ');

function hostFromEnvUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

const configuredDevHost = hostFromEnvUrl(process.env.NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL);
// Host del dev server quando la WebView Capacitor punta al Mac (sezione 5 handoff).
const capacitorDevHost = hostFromEnvUrl(process.env.CAPACITOR_SERVER_URL);
const allowedDevOrigins = Array.from(
  new Set(
    ['*.ngrok-free.dev', configuredDevHost, capacitorDevHost, ...localNetworkIPs()].filter(
      (host): host is string => Boolean(host),
    ),
  )
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins,
  async headers() {
    const securityHeaders = [
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
      },
      {
        key: 'Content-Security-Policy',
        value: csp,
      },
    ];

    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
