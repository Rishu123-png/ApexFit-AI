import type { MetadataRoute } from 'next';

/**
 * No production domain is hard-coded (spec §31). `NEXT_PUBLIC_SITE_URL` may be
 * set in Vercel to emit an origin-qualified sitemap reference; the file works
 * without it.
 */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/arena', '/insights', '/nutrition', '/workouts'] }],
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
