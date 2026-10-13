import type { Locale } from '@/i18n/config';

/** The same numbers in either language: a decimal comma in Spanish, a point in English. */
export function formatMetric(locale: Locale, unit: string, signed = false) {
  const digits = unit === 'score' ? 0 : unit === 'seconds' ? 1 : 3;
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: unit === 'shift' ? 0 : digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  });
  return (value: number) => (unit === 'seconds' ? `${format.format(value)} s` : format.format(value));
}
