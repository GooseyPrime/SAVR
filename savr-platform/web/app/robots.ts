import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.savr.cam';

// Public marketing pages are crawlable; signed-in areas, APIs and internal
// tools are not, so search results only ever point at pages a visitor can open.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/inventory',
          '/grocery-lists',
          '/meal-plans',
          '/preferences',
          '/settings',
          '/upload',
          '/chat',
          '/recipes',
          '/recipe',
          '/cook/',
          '/transfer/',
          '/labeling',
          '/export-dataset',
          '/subscription-debug',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
