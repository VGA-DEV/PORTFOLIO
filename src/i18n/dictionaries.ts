import { notFound } from 'next/navigation';
import { lang } from 'next/root-params';
import { hasLocale, type Locale } from './config';

type Dictionary = typeof import('@content/messages/es.json');

// `satisfies` keeps both languages with exactly the same keys.
const dictionaries = {
  es: () => import('@content/messages/es.json').then((m) => m.default),
  en: () =>
    import('@content/messages/en.json').then(
      (m) => m.default satisfies Dictionary,
    ),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}
