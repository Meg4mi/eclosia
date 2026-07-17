import type { Metadata, Viewport } from 'next';
import { Fraunces, Newsreader } from 'next/font/google';
import { APP_NAME, APP_DESCRIPTION, THEME_COLOR, APP_URL, APP_KEYWORDS } from '@/lib/config';
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
// au runtime, §2). La carte de partage /og.png (1200×630) est générée hors ligne
// par scripts/gen-og.mjs et committée — aucun asset distant.
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [...APP_KEYWORDS],
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: APP_NAME },
  // Favicon d'onglet : réutilise les icônes PNG statiques existantes (aucun asset
  // distant, aucune requête réseau au runtime, §2). Sans ce champ, le navigateur
  // requête /favicon.ico, ne trouve rien et n'affiche aucune favicon.
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
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
    images: [{ url: '/og.png', width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ['/og.png'],
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
      <body>{children}</body>
    </html>
  );
}
