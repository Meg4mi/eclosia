import type { MetadataRoute } from 'next';
import { APP_NAME, APP_DESCRIPTION, THEME_COLOR } from '@/lib/config';
// le manifest est statique : comme APP_DESCRIPTION, il parle la langue par défaut
import fr from '@/i18n/fr.json';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    // appui long sur l'icône installée → saisie directe (le SW sert /?log=1 hors-ligne)
    shortcuts: [
      {
        name: fr.manifest.shortcut_log,
        description: fr.manifest.shortcut_log_desc,
        url: '/?log=1',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
