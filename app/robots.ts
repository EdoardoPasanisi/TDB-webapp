import type { MetadataRoute } from 'next';

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL ||
    'https://app.tenutadelbarone.com'
  ).replace(/\/+$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/terms', '/cookies', '/dogs/card/'],
        disallow: [
          '/account',
          '/admin',
          '/api',
          '/chat',
          '/dogs',
          '/profile',
          '/services',
          '/settings',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
