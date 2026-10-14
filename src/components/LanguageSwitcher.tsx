'use client';

import { localeNames, locales, type Locale } from '@/i18n/config';

type LanguageSwitcherProps = {
  current: Locale;
  label: string;
};

const STORAGE_KEY = 'portfolio:language-switch';

/**
 * Remember which section the visitor is in and how far into it, so the other
 * language opens in the same place instead of back at the top.
 */
function rememberPosition() {
  try {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-watch-section]'));
    const line = window.innerHeight * 0.35;
    let active = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) active = section;
    }
    if (!active) return;
    const id = active.id || 'hero';
    const offset = line - active.getBoundingClientRect().top;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id, offset, at: Date.now() }));
  } catch {
    // Private mode: the other language simply opens at the top.
  }
}

export function LanguageSwitcher({ current, label }: LanguageSwitcherProps) {
  return (
    <nav aria-label={label} className='lang-switcher'>
      <ul>
        {locales.map((locale) => (
          <li key={locale}>
            {/* A plain link: a full page load starts the 3D scene cleanly in the new language. */}
            <a
              href={`/${locale}/`}
              hrefLang={locale}
              lang={locale}
              aria-label={localeNames[locale]}
              aria-current={locale === current ? 'true' : undefined}
              onClick={locale === current ? undefined : rememberPosition}
            >
              {locale.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
