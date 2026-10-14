export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

/** Each language's own name, for the language links' accessible names. */
export const localeNames: Record<Locale, string> = { es: 'Español', en: 'English' };
