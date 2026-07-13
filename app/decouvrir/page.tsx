import type { Metadata } from 'next';
import { getDict, tpl } from '@/i18n';
import { APP_NAME } from '@/lib/config';
import { Discover } from '@/components/discover/Discover';

const d = getDict('fr').discover;
const description = tpl(d.meta_description, { app: APP_NAME });

export const metadata: Metadata = {
  title: d.title,
  description,
  alternates: {
    canonical: '/decouvrir',
    languages: { fr: '/decouvrir', en: '/discover', 'x-default': '/decouvrir' },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/decouvrir',
    siteName: APP_NAME,
    title: `${d.title} · ${APP_NAME}`,
    description,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: APP_NAME }],
  },
};

export default function DecouvrirPage() {
  return <Discover locale="fr" />;
}
