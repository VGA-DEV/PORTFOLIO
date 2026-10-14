import metrics from '@content/evolution/metrics.json';
import type { Locale } from '@/i18n/config';
import { formatMetric } from '@/lib/metric-format';
import { CountUp } from './CountUp';
import { ScoreHelp } from './ScoreHelp';
import { Tilt } from './Tilt';

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
    whatIs: string;
    rows: Record<string, string>;
    help: Record<string, string>;
  };
};

type Row = (typeof metrics.rows)[number];
type Device = 'mobile' | 'desktop';

/** Scores go up when they improve; times and layout shifts go down. */
const improves = (unit: string, change: number) => (unit === 'score' ? change > 0 : change < 0);

/**
 * The archive of versions: one card per version with its own Lighthouse numbers, mobile and desktop.
 * From the second version on, each number counts from its old value to the new one when the section
 * arrives, and carries the change against the version before it. Each label has a small «?» that says
 * in a sentence what it measures. The runs are kept per version in `content/evolution/metrics.json`:
 * adding a version is adding its entry there and in the dictionaries.
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
            const tipId = `tip-${version.id}-${device}-${row.id}`;
            const name = labels.metrics.rows[row.id];
            // The same six labels repeat in every column. Only the first set shows a «?», is in the tab
            // order and is read out; in the others the label itself answers to the mouse, and a hidden
            // placeholder keeps the labels wrapping the same way, so nothing adds noise or tab stops.
            const first = version.current && device === 'mobile';
            return (
              <div key={row.id} className='score'>
                <dt>
                  <span>{name}</span>
                  {first ? (
                    <ScoreHelp
                      label={`${labels.metrics.whatIs} ${name}`}
                      tipId={tipId}
                      text={labels.metrics.help[row.id]}
                    />
                  ) : (
                    <>
                      <span className='score__help score__help--ghost' aria-hidden='true' />
                      <span aria-hidden='true' className='score__tip'>
                        {labels.metrics.help[row.id]}
                      </span>
                    </>
                  )}
                </dt>
                <dd>
                  <CountUp to={value} unit={row.unit} locale={locale} order={metrics.rows.indexOf(row)} />
                  {before === null ? null : better ? (
                    <span className='score__change'>
                      <span className='sr-only'>{labels.metrics.better}</span>
                      {formatMetric(locale, row.unit, true)(change)}
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
        <li key={version.id} className={version.current ? 'version version--now' : 'version'} data-excite>
          <Tilt className='version__card'>
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
            <div className='version__devices'>
              {devices.map((device) => (
                <div key={device}>{scores(version, device)}</div>
              ))}
            </div>
            <p className='version__measure'>{version.measure}</p>
          </Tilt>
        </li>
      ))}
    </ol>
  );
}
