import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/config';

// sitemap.xml figé au build (export statique). Racine (l'app) + pages de
// contenu bilingues, seules porteuses de texte indexable. Les hreflang lient
// les variantes fr/en pour Google.
export const dynamic = 'force-static';

const discoverLanguages = {
  fr: `${APP_URL}/decouvrir`,
  en: `${APP_URL}/discover`,
};

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, changeFrequency: 'monthly', priority: 1 },
    {
      url: `${APP_URL}/decouvrir`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: discoverLanguages },
    },
    {
      url: `${APP_URL}/discover`,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: discoverLanguages },
    },
  ];
}
