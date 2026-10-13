import type { Locale } from '@/i18n/config';

/** Months since year 0 for a `YYYY-MM` string. */
const monthIndex = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return year * 12 + (month - 1);
};

/** Whole months between a start and an end (`YYYY-MM`); an empty end means today. */
export function monthsBetween(start: string, end: string) {
  const today = new Date();
  const stop = end ? monthIndex(end) : today.getFullYear() * 12 + today.getMonth();
  return Math.max(stop - monthIndex(start), 1);
}

/** «2 años y 5 meses» or «2 years and 5 months», from a number of months. */
export function formatDuration(locale: Locale, months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const unit = (value: number, name: 'year' | 'month') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'long' }).format(value);
  const parts = [years > 0 ? unit(years, 'year') : null, rest > 0 || years === 0 ? unit(rest, 'month') : null].filter(
    (part): part is string => part !== null,
  );
  return new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' }).format(parts);
}
