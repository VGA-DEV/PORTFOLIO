import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { getProfile } from '@/i18n/content';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = getProfile();

  return locales.map((locale) => ({
    url: `${siteUrl}/${locale}/`,
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [l, `${siteUrl}/${l}/`]),
      ),
    },
  }));
}
