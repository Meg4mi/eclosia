import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/config';

// robots.txt figé au build (export statique, aucune requête réseau au runtime).
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
