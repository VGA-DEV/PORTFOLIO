import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CursorLight } from '@/components/CursorLight';
import { DecoRule } from '@/components/DecoRule';
import { DownloadLink } from '@/components/DownloadLink';
import { EvolutionArchive } from '@/components/EvolutionArchive';
import { Hero } from '@/components/Hero';
import { Section } from '@/components/Section';
import { BackdropSweep } from '@/components/BackdropSweep';
import { WatchBackdrop } from '@/components/WatchBackdrop';
import { getProfile, getStack } from '@/i18n/content';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import { formatDuration, monthsBetween } from '@/lib/duration';

/** Pending, in development, working: one, two or three of three. */
const STATUS_LEVEL: Record<string, number> = { pending: 1, inDevelopment: 2, working: 3 };

const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');

/** The CV files that exist in `public/cv/`, the one in the page's language first. Nothing is shown for a missing file. */
function cvLinks(locale: string, labels: { es: string; en: string }) {
  const all = [
    { lang: 'es', file: 'cv-victor-gomez-es.pdf', label: labels.es },
    { lang: 'en', file: 'cv-victor-gomez-en.pdf', label: labels.en },
  ];
  return all
    .filter((cv) => existsSync(join(process.cwd(), 'public', 'cv', cv.file)))
    .sort((a, b) => Number(b.lang === locale) - Number(a.lang === locale));
}

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const profile = getProfile();
  const cvs = cvLinks(locale, { es: dict.contact.cvEs, en: dict.contact.cvEn });
  const stack = getStack(locale);
  // How long each job lasted (the full run of the longest one fills its bar), counted when the site is built.
  const jobMonths = dict.experience.items.map((job) => monthsBetween(job.start, job.end));
  const longestJob = Math.max(...jobMonths);

  return (
    <>
      <BackdropSweep />
      <CursorLight />
      <WatchBackdrop
        logoUrl='/images/logo-vga-dev.webp'
        notes={[
          '',
          dict.notes.projects.text,
          dict.notes.experience.text,
          dict.notes.stack.text,
          dict.notes.evolution.text,
          dict.notes.contact.text,
        ]}
        crown={dict.crown}
      />
      <Hero
        name={dict.hero.name}
        role={dict.hero.role}
        intro={dict.hero.intro}
      />

      <Section
        id='projects'
        part={dict.notes.projects.part}
        title={dict.projects.title}
        side='right'
      >
        <ol className='ledger ledger--entries'>
          {dict.projects.items.map((project) => (
            <li key={project.name} className='ledger__row' data-excite>
              <div className='ledger__head'>
                <h3 className='ledger__title'>{project.name}</h3>
                <p className='status'>
                  <span className='sr-only'>{dict.projects.statusLabel}: </span>
                  <span
                    className='status__level'
                    data-level={STATUS_LEVEL[project.status] ?? 1}
                    aria-hidden='true'
                  />
                  {dict.projects.status[project.status as keyof typeof dict.projects.status]}
                </p>
              </div>
              <div className='ledger__body'>
                <p>{project.summary}</p>
                <p className='ledger__stack'>
                  <span className='ledger__label'>{dict.projects.stackLabel}</span>
                  {project.stack.join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id='experience'
        part={dict.notes.experience.part}
        tone='mist'
        title={dict.experience.title}
        side='left'
      >
        <ol className='timeline'>
          {dict.experience.items.map((job, index) => (
            <li
              key={job.company}
              className={job.current ? 'timeline__entry timeline__entry--now' : 'timeline__entry'}
              data-excite
            >
              <div className='ledger__head'>
                <h3 className='ledger__title'>{job.company}</h3>
                <p className='ledger__period'>{job.period}</p>
              </div>
              <div className='ledger__body'>
                <div className='timeline__meta'>
                  <p className='ledger__role'>{job.role}</p>
                  <p className='timeline__duration'>
                    <span className='timeline__bar' aria-hidden='true'>
                      <i style={{ ['--w' as string]: `${Math.round((jobMonths[index] / longestJob) * 100)}%` }} />
                    </span>
                    <span className='sr-only'>{dict.experience.durationLabel}: </span>
                    {formatDuration(locale, jobMonths[index])}
                  </p>
                </div>
                <p>{job.summary}</p>
                <p className='ledger__stack'>
                  <span className='ledger__label'>{dict.experience.stackLabel}</span>
                  {job.stack.join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id='stack' title={dict.stack.title} part={dict.notes.stack.part} side='right'>
        <div className='stack'>
          {stack.map((group) => (
            <div key={group.id} className='stack__group' data-excite>
              <h3 className='stack__title'>
                {dict.stack.groups[group.id as keyof typeof dict.stack.groups]}
              </h3>
              <ul className='stack__list'>
                {group.items.map((item) => (
                  <li key={item.label} className={item.core ? 'stack__core' : undefined}>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id='evolution'
        part={dict.notes.evolution.part}
        tone='mist'
        title={dict.evolution.title}
        side='left'
      >
        <EvolutionArchive
          locale={locale}
          versions={dict.evolution.versions}
          labels={{
            tagLabel: dict.evolution.tagLabel,
            currentLabel: dict.evolution.currentLabel,
            metrics: dict.evolution.metrics,
          }}
        />
      </Section>

      <Section
        id='contact'
        part={dict.notes.contact.part}
        title={dict.contact.title}
        intro={dict.contact.intro}
        side='right'
        tone='stage'
        dwell={false}
        align='center'
      >
        <div className='engraving'>
          <DecoRule className='engraving__rule' />
          <ul className='engraving__links'>
            <li data-excite>
              <a href={`mailto:${profile.email}`}>
                <span className='engraving__label'>{dict.contact.email}</span>
                {profile.email}
              </a>
            </li>
            <li data-excite>
              <a href={profile.linkedin} rel='noopener noreferrer' target='_blank'>
                <span className='engraving__label'>{dict.contact.linkedin}</span>
                {displayUrl(profile.linkedin)}
              </a>
            </li>
            <li data-excite>
              <a href={profile.github} rel='noopener noreferrer' target='_blank'>
                <span className='engraving__label'>{dict.contact.github}</span>
                {displayUrl(profile.github)}
              </a>
            </li>
          </ul>
          <DecoRule className='engraving__rule' />
          {cvs.length > 0 ? (
            <div className='contact-cv'>
              <h3 className='contact-cv__title'>{dict.contact.cvTitle}</h3>
              <ul className='contact-cv__list'>
                {cvs.map((cv) => (
                  <li key={cv.file}>
                    <DownloadLink href={`/cv/${cv.file}`} label={cv.label} started={dict.contact.cvStarted} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Section>
    </>
  );
}
