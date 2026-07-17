import Link from 'next/link';
import { getDict, tpl, type Locale } from '@/i18n';
import { APP_NAME, APP_URL, REPO_URL } from '@/lib/config';
import styles from './discover.module.css';

// Page de contenu prérendue en HTML statique (Server Component, aucun hook
// client) : c'est le seul texte indexable de l'app. Tout passe par i18n ;
// le nom de l'app est injecté via {app} (jamais écrit en dur, §config).

/** Données structurées schema.org, figées au build. Catégorie « lifestyle »
 * et non « health » : aucune revendication médicale (§non-objectifs). */
function jsonLd(locale: Locale): string {
  const d = getDict(locale).discover;
  const app = { app: APP_NAME };
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: APP_NAME,
      url: APP_URL,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      description: tpl(d.meta_description, app),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: d.faq.map((f) => ({
        '@type': 'Question',
        name: tpl(f.q, app),
        acceptedAnswer: { '@type': 'Answer', text: tpl(f.a, app) },
      })),
    },
  ]);
}

export function Discover({ locale }: { locale: Locale }) {
  const d = getDict(locale).discover;
  const app = { app: APP_NAME };
  const altHref = locale === 'fr' ? '/discover' : '/decouvrir';

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(locale) }} />

      <header className={styles.hero}>
        <p className={styles.wordmark}>{APP_NAME}</p>
        <h1 className={styles.title}>{d.hero_title}</h1>
        <p className={styles.lede}>{tpl(d.hero_body, app)}</p>
        <ul className={styles.pillars}>
          {d.pillars.map((pillar) => (
            <li key={pillar}>{pillar}</li>
          ))}
        </ul>
        <Link href="/" className={styles.cta}>
          {tpl(d.open_app, app)}
        </Link>
      </header>

      <section className={styles.section}>
        <h2 className={styles.h2}>{d.privacy_title}</h2>
        <p className={styles.body}>{tpl(d.privacy_body, app)}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{d.how_title}</h2>
        <ul className={styles.list}>
          <li>{d.how_dial}</li>
          <li>{d.how_log}</li>
          <li>{d.how_predict}</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{tpl(d.not_title, app)}</h2>
        <ul className={styles.list}>
          <li>{tpl(d.not_medical, app)}</li>
          <li>{tpl(d.not_pregnancy, app)}</li>
          <li>{tpl(d.not_ads, app)}</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{tpl(d.install_title, app)}</h2>
        <p className={styles.body}>{tpl(d.install_body, app)}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{d.source_title}</h2>
        <p className={styles.body}>{tpl(d.source_body, app)}</p>
        <a
          href={REPO_URL}
          className={styles.sourceLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          {d.source_link}
        </a>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{d.faq_title}</h2>
        <dl className={styles.faq}>
          {d.faq.map((f) => (
            <div key={f.q} className={styles.faqItem}>
              <dt className={styles.faqQ}>{tpl(f.q, app)}</dt>
              <dd className={styles.faqA}>{tpl(f.a, app)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.cta}>
          {tpl(d.open_app, app)}
        </Link>
        <Link href={altHref} className={styles.langLink} hrefLang={locale === 'fr' ? 'en' : 'fr'}>
          {d.lang_switch}
        </Link>
      </footer>
    </main>
  );
}
