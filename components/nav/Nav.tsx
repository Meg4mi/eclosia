'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/AppShell';
import styles from './nav.module.css';

const DESTINATIONS = [
  { href: '/', key: 'today' },
  { href: '/history/', key: 'history' },
  { href: '/settings/', key: 'settings' },
] as const;

export function Nav() {
  const { dict } = useApp();
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {DESTINATIONS.map(({ href, key }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/\/$/, ''));
        return (
          <Link key={key} href={href} className={active ? styles.linkActive : styles.link}>
            {dict.nav[key]}
          </Link>
        );
      })}
    </nav>
  );
}
