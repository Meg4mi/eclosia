import type { Metadata, Viewport } from 'next';
import { Fraunces, Newsreader } from 'next/font/google';
import { APP_NAME, APP_DESCRIPTION, THEME_COLOR } from '@/lib/config';
import { AppShell } from '@/components/AppShell';
import { SwRegister } from '@/components/SwRegister';
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

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: APP_NAME },
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
        <SwRegister />
      </body>
    </html>
  );
}
