import Link from 'next/link';
import { locales, type Locale } from '@/i18n/config';

type LanguageSwitcherProps = {
  current: Locale;
  label: string;
};

export function LanguageSwitcher({ current, label }: LanguageSwitcherProps) {
  return (
    <nav aria-label={label} className='lang-switcher'>
      <ul>
        {locales.map((locale) => (
          <li key={locale}>
            <Link
              href={`/${locale}/`}
              prefetch={false}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? 'true' : undefined}
            >
              {locale.toUpperCase()}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
