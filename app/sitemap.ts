import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/config';

// sitemap.xml figé au build (export statique). L'app est une SPA à une entrée :
// seule la racine est indexable, le reste est du contenu local par appareil.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: APP_URL, changeFrequency: 'monthly', priority: 1 }];
}
