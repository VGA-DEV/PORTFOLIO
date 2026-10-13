import profile from '@content/profile.json';
import stack from '@content/stack.json';
import type { Locale } from './config';

type LocalizedText = string | { es: string; en: string };

export const getProfile = () => profile;

/** Each item says whether it belongs to the base the profile is built on (.NET and React). */
export function getStack(locale: Locale) {
  return stack.map((group) => {
    const core = 'core' in group ? (group.core as string[]) : [];
    return {
      id: group.id,
      items: (group.items as LocalizedText[]).map((item) => {
        const label = typeof item === 'string' ? item : item[locale];
        return { label, core: core.includes(label) };
      }),
    };
  });
}
