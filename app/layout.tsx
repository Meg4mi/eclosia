import type { Metadata, Viewport } from 'next';
import { Fraunces, Newsreader } from 'next/font/google';
import { APP_NAME, APP_DESCRIPTION, THEME_COLOR, APP_URL, APP_KEYWORDS } from '@/lib/config';
import { AppShell } from '@/components/AppShell';
import './globals.css';

// Fonts self-hostées via next/font : aucune requête réseau au runtime (§2).
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-newsreader',
  display: 'swap',
});

// SEO : métadonnées 100 % statiques, générées au build (aucune requête réseau
// au runtime, §2). L'image OG réutilise l'icône existante — aucun asset distant.
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [...APP_KEYWORDS],
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: APP_NAME },
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/',
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: APP_NAME }],
  },
  twitter: {
    card: 'summary',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ['/icons/icon-512.png'],
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${newsreader.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
