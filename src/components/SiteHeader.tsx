import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { LanguageSwitcher } from './LanguageSwitcher';

type SiteHeaderProps = {
  locale: Locale;
  name: string;
  nav: Record<'projects' | 'experience' | 'stack' | 'evolution' | 'contact', string>;
  navLabel: string;
  languageLabel: string;
};

const sections = ['projects', 'experience', 'stack', 'evolution', 'contact'] as const;

export function SiteHeader({
  locale,
  name,
  nav,
  navLabel,
  languageLabel,
}: SiteHeaderProps) {
  return (
    <header className='site-header'>
      <div className='container site-header__inner'>
        <Link href={`/${locale}/`} className='site-header__brand' prefetch={false}>
          {name}
        </Link>
        <nav aria-label={navLabel} className='site-header__nav'>
          <ul>
            {sections.map((id) => (
              <li key={id}>
                <a href={`#${id}`}>{nav[id]}</a>
              </li>
            ))}
          </ul>
        </nav>
        <LanguageSwitcher current={locale} label={languageLabel} />
      </div>
    </header>
  );
}
