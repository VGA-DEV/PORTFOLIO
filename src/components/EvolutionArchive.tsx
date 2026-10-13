import metrics from '@content/evolution/metrics.json';
import type { Locale } from '@/i18n/config';

type Version = {
  id: string;
  tag: string;
  name: string;
  current: boolean;
  measure: string;
  summary: string;
};

type Labels = {
  tagLabel: string;
  currentLabel: string;
  metrics: {
    mobile: string;
    desktop: string;
    better: string;
    rows: Record<string, string>;
  };
};

type Row = (typeof metrics.rows)[number];
type Device = 'mobile' | 'desktop';

/** The same numbers in either language: a decimal comma in Spanish, a point in English. */
function formatter(locale: Locale, unit: string, signed = false) {
  const digits = unit === 'score' ? 0 : unit === 'seconds' ? 1 : 3;
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: unit === 'shift' ? 0 : digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  });
  return (value: number) => (unit === 'seconds' ? `${format.format(value)} s` : format.format(value));
}

/** Scores go up when they improve; times and layout shifts go down. */
const improves = (unit: string, change: number) => (unit === 'score' ? change > 0 : change < 0);

/**
 * The archive of versions: one card per version with its own Lighthouse numbers, mobile and desktop.
 * From the second version on, each number that got better carries the change against the version
 * before it. The runs are kept per version in `content/evolution/metrics.json`: adding a version is
 * adding its entry there and in the dictionaries.
 */
export function EvolutionArchive({
  locale,
  versions,
  labels,
}: {
  locale: Locale;
  versions: Version[];
  labels: Labels;
}) {
  const devices: Device[] = ['mobile', 'desktop'];

  const scores = (version: Version, device: Device) => {
    const index = metrics.versions.findIndex((run) => run.id === version.id);
    const run = metrics.versions[index];
    const before = index > 0 ? metrics.versions[index - 1] : null;
    if (!run) return null;
    return (
      <section className='scores'>
        <h4 className='scores__device'>{labels.metrics[device]}</h4>
        <dl className='scores__grid'>
          {metrics.rows.map((row: Row) => {
            const key = row.id as keyof typeof run.mobile;
            const value = run[device][key];
            const change = before ? value - before[device][key] : 0;
            const better = before !== null && improves(row.unit, change);
            return (
              <div key={row.id} className='score'>
                <dt>{labels.metrics.rows[row.id]}</dt>
                <dd>
                  {formatter(locale, row.unit)(value)}
                  {before === null ? null : better ? (
                    <span className='score__change'>
                      <span className='sr-only'>{labels.metrics.better}</span>
                      {formatter(locale, row.unit, true)(change)}
                    </span>
                  ) : (
                    // The slot stays, empty, so every figure in the grid sits on the same line.
                    <span className='score__change score__change--none' aria-hidden='true'>
                      &nbsp;
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    );
  };

  return (
    <ol className='versions'>
      {versions.map((version) => (
        <li key={version.id} className={version.current ? 'version version--now' : 'version'}>
          <div className='ledger__head'>
            <h3 className='ledger__title'>
              {version.name}
              {version.current ? <span className='ledger__badge'>{labels.currentLabel}</span> : null}
            </h3>
            {version.tag ? (
              <p className='ledger__period'>
                <span className='sr-only'>{labels.tagLabel}: </span>
                <code>{version.tag}</code>
              </p>
            ) : null}
          </div>
          <p className='version__summary'>{version.summary}</p>
          <div className='version__devices'>{devices.map((device) => <div key={device}>{scores(version, device)}</div>)}</div>
          <p className='version__measure'>{version.measure}</p>
        </li>
      ))}
    </ol>
  );
}
