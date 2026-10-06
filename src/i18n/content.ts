import profile from '@content/profile.json';
import stack from '@content/stack.json';
import type { Locale } from './config';

type LocalizedText = string | { es: string; en: string };

export const getProfile = () => profile;

export function getStack(locale: Locale) {
  return stack.map((group) => ({
    id: group.id,
    items: (group.items as LocalizedText[]).map((item) =>
      typeof item === 'string' ? item : item[locale],
    ),
  }));
}
