import type { Metadata } from 'next';
import { Josefin_Sans, Poiret_One } from 'next/font/google';
import { ScrollRestore } from '@/components/ScrollRestore';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { defaultLocale, locales } from '@/i18n/config';
import { getProfile } from '@/i18n/content';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import './globals.css';

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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary();
  const { siteUrl } = getProfile();

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
      locale: locale === 'es' ? 'es_ES' : 'en_GB',
      // TODO (Phase 4): add an Open Graph image.
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body>
        <a className='skip-link' href='#main'>
          {dict.a11y.skipToContent}
        </a>
        <SiteHeader
          locale={locale}
          name={dict.hero.name}
          nav={dict.nav}
          navLabel={dict.a11y.mainNav}
          languageLabel={dict.a11y.language}
        />
        <ScrollRestore />
        <main id='main'>{children}</main>
        <SiteFooter rights={dict.footer.rights} logoAlt={dict.footer.logoAlt} />
      </body>
    </html>
  );
}
