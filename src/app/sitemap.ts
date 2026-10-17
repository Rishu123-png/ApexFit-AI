import type { MetadataRoute } from 'next';

/** Public, crawlable routes only — app content is auth-gated. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!site) return [];
  const now = new Date();
  return [
    { url: `${site}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${site}/plans`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
