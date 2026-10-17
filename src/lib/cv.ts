import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The CV files that exist in `public/cv/`, the one in the page's language first. Nothing is listed for a missing file. */
export function cvLinks(locale: string, labels: { es: string; en: string }) {
  const all = [
    { lang: 'es', file: 'cv-victor-gomez-es.pdf', label: labels.es },
    { lang: 'en', file: 'cv-victor-gomez-en.pdf', label: labels.en },
  ];
  return all
    .filter((cv) => existsSync(join(process.cwd(), 'public', 'cv', cv.file)))
    .sort((a, b) => Number(b.lang === locale) - Number(a.lang === locale));
}
