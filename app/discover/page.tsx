import type { Metadata } from 'next';
import { getDict, tpl } from '@/i18n';
import { APP_NAME } from '@/lib/config';
import { Discover } from '@/components/discover/Discover';

const d = getDict('en').discover;
const description = tpl(d.meta_description, { app: APP_NAME });

export const metadata: Metadata = {
  title: d.title,
  description,
  alternates: {
    canonical: '/discover',
    languages: { fr: '/decouvrir', en: '/discover', 'x-default': '/decouvrir' },
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: '/discover',
    siteName: APP_NAME,
    title: `${d.title} · ${APP_NAME}`,
    description,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: APP_NAME }],
  },
};

export default function DiscoverPage() {
  return <Discover locale="en" />;
}
