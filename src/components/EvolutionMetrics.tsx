import metrics from '@content/evolution/metrics.json';
import type { Locale } from '@/i18n/config';

type Labels = {
  title: string;
  mobile: string;
  desktop: string;
  from: string;
  to: string;
  rows: Record<string, string>;
  note: string;
};

/** The same numbers in either language: a decimal comma in Spanish, a point in English. */
function formatter(locale: Locale, unit: string) {
  const digits = unit === 'score' ? 0 : unit === 'seconds' ? 1 : 3;
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: unit === 'shift' ? 0 : digits,
    maximumFractionDigits: digits,
  });
  return (value: number) => (unit === 'seconds' ? `${format.format(value)} s` : format.format(value));
}

/** Before and now, from the Lighthouse runs kept in `content/evolution/metrics.json`. */
export function EvolutionMetrics({ locale, labels }: { locale: Locale; labels: Labels }) {
  return (
    <div className='metrics'>
      <table>
        <caption className='metrics__title'>{labels.title}</caption>
        <thead>
          <tr>
            <td />
            <th scope='col'>{labels.mobile}</th>
            <th scope='col'>{labels.desktop}</th>
          </tr>
        </thead>
        <tbody>
          {metrics.rows.map((row) => {
            const format = formatter(locale, row.unit);
            const cell = ([before, now]: number[]) => (
              <span className='delta'>
                <span className='sr-only'>{labels.from} </span>
                <span className='delta__from'>{format(before)}</span>
                <span className='delta__arrow' aria-hidden='true' />
                <span className='sr-only'> {labels.to} </span>
                <span className='delta__to'>{format(now)}</span>
              </span>
            );
            return (
              <tr key={row.id}>
                <th scope='row'>{labels.rows[row.id]}</th>
                <td>{cell(row.mobile)}</td>
                <td>{cell(row.desktop)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className='metrics__note'>{labels.note}</p>
    </div>
  );
}
