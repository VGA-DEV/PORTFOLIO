import type { Metadata, Viewport } from 'next';
import { Josefin_Sans, Poiret_One } from 'next/font/google';
import { ScrollRestore } from '@/components/ScrollRestore';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { defaultLocale, locales } from '@/i18n/config';
import { getProfile, getStack } from '@/i18n/content';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { cvLinks } from '@/lib/cv';
// The stylesheet is split by area. The order of these imports IS the cascade order (later files override
// earlier ones, and some rules rely on it), so keep it.
import './styles/base.css';
import './styles/header.css';
import './styles/hero.css';
import './styles/layout.css';
import './styles/content.css';
import './styles/compare.css';
import './styles/footer.css';
import './styles/watch-controls.css';
import './styles/sweep.css';
import './styles/interactions.css';

// Self-hosted at build time by next/font: no third-party request at runtime.
const display = Poiret_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const sans = Josefin_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Only the declared locales exist; anything else is a 404 in the static export.
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// The browser bar on phones takes the colour of the dark header.
export const viewport: Viewport = {
  themeColor: '#120818',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary();
  const { siteUrl } = getProfile();
  const image = {
    url: `/og-${locale}.jpg`,
    width: 1200,
    height: 630,
    alt: dict.meta.imageAlt,
  };

  return {
    metadataBase: new URL(siteUrl),
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}/`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `/${l}/`])),
        'x-default': `/${defaultLocale}/`,
      },
    },
    openGraph: {
      type: 'website',
      title: dict.meta.title,
      description: dict.meta.description,
      url: `/${locale}/`,
      siteName: dict.hero.name,
      locale: locale === 'es' ? 'es_ES' : 'en_GB',
      alternateLocale: locale === 'es' ? ['en_GB'] : ['es_ES'],
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.meta.title,
      description: dict.meta.description,
      images: [image],
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale();
  const dict = await getDictionary();
  const { siteUrl, linkedin, github } = getProfile();
  // The header offers the CV of the page's language, once the file is in `public/cv/`.
  const [cv] = cvLinks(locale, { es: dict.contact.cvEs, en: dict.contact.cvEn });
  // What a search engine can read about the person: only what the page already says publicly.
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: dict.hero.name,
    jobTitle: dict.meta.jobTitle,
    description: dict.meta.description,
    url: `${siteUrl}/${locale}/`,
    image: `${siteUrl}/og-${locale}.jpg`,
    address: { '@type': 'PostalAddress', addressLocality: 'Madrid', addressCountry: 'ES' },
    worksFor: { '@type': 'Organization', name: dict.experience.items.find((item) => item.current)?.company },
    knowsAbout: getStack(locale).flatMap((group) => group.items.map((item) => item.label)),
    sameAs: [linkedin, github],
  };

  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body>
        <script
          type='application/ld+json'
          // The data with every "<" escaped, so nothing in it can close the tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, '\\u003c') }}
        />
        <noscript>
          <style>
            {'.hero__watch .dial,.hero__watch .watch__frame{opacity:1!important}.site-header__cv{opacity:1!important;visibility:visible!important}'}
          </style>
        </noscript>
        <a className='skip-link' href='#main'>
          {dict.a11y.skipToContent}
        </a>
        <SiteHeader
          locale={locale}
          name={dict.hero.name}
          nav={dict.nav}
          navLabel={dict.a11y.mainNav}
          languageLabel={dict.a11y.language}
          cv={cv ? { href: `/cv/${cv.file}`, label: dict.nav.cv, name: cv.label } : undefined}
        />
        <ScrollRestore />
        <main id='main'>{children}</main>
        <SiteFooter rights={dict.footer.rights} logoAlt={dict.footer.logoAlt} />
      </body>
    </html>
  );
}
