import { AppShell } from '@/components/AppShell';

// Layout du groupe applicatif : c'est ici que vit AppShell (IndexedDB,
// Motion, service worker). Les pages de contenu statique (/decouvrir, /discover)
// restent hors de ce groupe pour être prérendues en HTML — indexables.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
