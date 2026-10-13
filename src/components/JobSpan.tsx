type Job = {
  company: string;
  role: string;
  period: string;
  start: string;
  end: string;
  summary: string;
  stack: string[];
  current: boolean;
};

type Props = {
  jobs: Job[];
  stackLabel: string;
  axisLabel: string;
  nowLabel: string;
};

/** Months since year 0 for a `YYYY-MM` string, so spans can be compared and measured. */
const monthIndex = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return year * 12 + (month - 1);
};

/**
 * The jobs on a time axis drawn to scale: one segment per job, as long as the job lasted, with a
 * month track under it. Each job's text hangs from its own segment: the current one under the
 * segment on the right, the earlier one under the segment on the left.
 */
export function JobSpan({ jobs, stackLabel, axisLabel, nowLabel }: Props) {
  const today = new Date();
  const now = today.getFullYear() * 12 + today.getMonth() + today.getDate() / 31;
  const spans = jobs.map((job) => ({
    job,
    from: monthIndex(job.start),
    to: job.end ? monthIndex(job.end) : now,
  }));
  const first = Math.min(...spans.map((span) => span.from));
  const total = Math.max(...spans.map((span) => span.to)) - first;
  const percent = (months: number) => ((months - first) / total) * 100;

  const firstYear = Math.floor(first / 12);
  const lastYear = Math.floor(now / 12);
  const januaries = Array.from({ length: lastYear - firstYear }, (_, i) => firstYear + 1 + i);

  return (
    <div className='span'>
      <div className='span__axis' role='img' aria-label={axisLabel}>
        <div className='span__bar'>
          {spans.map(({ job, from, to }) => (
            <span
              key={job.company}
              className={job.current ? 'span__seg span__seg--now' : 'span__seg'}
              style={{ left: `${percent(from)}%`, width: `${percent(to) - percent(from)}%` }}
            />
          ))}
        </div>
        <div className='span__track' style={{ ['--months' as string]: Math.round(total) }} />
        <ul className='span__years' aria-hidden='true'>
          <li style={{ left: 0 }} data-edge='start'>
            {firstYear}
          </li>
          {januaries.map((year) => (
            <li key={year} style={{ left: `${percent(year * 12)}%` }}>
              {year}
            </li>
          ))}
          <li style={{ left: '100%' }} data-edge='end'>
            {nowLabel}
          </li>
        </ul>
      </div>
      <ol className='span__jobs'>
        {spans.map(({ job, from }) => (
          <li
            key={job.company}
            className={job.current ? 'span__job span__job--now' : 'span__job'}
            style={{ ['--from' as string]: `${percent(from)}%` }}
          >
            <div className='ledger__head'>
              <h3 className='ledger__title'>{job.company}</h3>
              <p className='ledger__period'>{job.period}</p>
            </div>
            <div className='ledger__body'>
              <p className='ledger__role'>{job.role}</p>
              <p>{job.summary}</p>
              <p className='ledger__stack'>
                <span className='ledger__label'>{stackLabel}</span>
                {job.stack.join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
