import { Hero } from '@/components/Hero';
import { Section } from '@/components/Section';
import { BackdropSweep } from '@/components/BackdropSweep';
import { WatchBackdrop } from '@/components/WatchBackdrop';
import { getProfile, getStack } from '@/i18n/content';
import { getDictionary, getLocale } from '@/i18n/dictionaries';

/** Pending, in development, working: one, two or three of three. */
const STATUS_LEVEL: Record<string, number> = { pending: 1, inDevelopment: 2, working: 3 };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const profile = getProfile();
  const stack = getStack(locale);

  return (
    <>
      <BackdropSweep />
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
        intro={dict.projects.intro}
        side='right'
      >
        <ol className='ledger ledger--projects'>
          {dict.projects.items.map((project) => (
            <li key={project.name} className='ledger__row'>
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
        intro={dict.experience.intro}
        side='left'
      >
        <ol className='ledger ledger--dated'>
          {dict.experience.items.map((job, index) => (
            <li key={job.company} className='ledger__row'>
              <div className='ledger__when'>
                <span className='ledger__numeral' aria-hidden='true'>
                  {ROMAN[index]}
                </span>
                <p className='ledger__period'>{job.period}</p>
              </div>
              <div className='ledger__body'>
                <h3 className='ledger__title'>{job.company}</h3>
                <p className='ledger__role'>{job.role}</p>
                <p>{job.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id='stack' title={dict.stack.title} part={dict.notes.stack.part} side='right'>
        <div className='stack'>
          {stack.map((group) => (
            <div key={group.id} className='stack__group'>
              <h3 className='stack__title'>
                {dict.stack.groups[group.id as keyof typeof dict.stack.groups]}
                <span className='stack__part'>
                  {dict.stack.parts[group.id as keyof typeof dict.stack.parts]}
                </span>
              </h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
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
        intro={dict.evolution.intro}
        side='left'
      >
        <ol className='ledger'>
          {dict.evolution.versions.map((version) => (
            <li key={version.tag} className='ledger__row'>
              <h3 className='ledger__title'>{version.name}</h3>
              <div className='ledger__body'>
                <p>{version.summary}</p>
                <p className='ledger__tag'>
                  {dict.evolution.tagLabel}: <code>{version.tag}</code>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id='contact'
        part={dict.notes.contact.part}
        title={dict.contact.title}
        intro={dict.contact.intro}
        side='right'
        tone='stage'
        dwell={false}
      >
        <ul className='contact-links'>
          <li>
            <a href={`mailto:${profile.email}`}>
              <span className='contact-links__label'>{dict.contact.email}</span>
              {profile.email}
            </a>
          </li>
          <li>
            <a href={profile.linkedin} rel='noopener noreferrer' target='_blank'>
              <span className='contact-links__label'>{dict.contact.linkedin}</span>
              {displayUrl(profile.linkedin)}
            </a>
          </li>
          <li>
            <a href={profile.github} rel='noopener noreferrer' target='_blank'>
              <span className='contact-links__label'>{dict.contact.github}</span>
              {displayUrl(profile.github)}
            </a>
          </li>
        </ul>
        <h3 className='contact-cv__title'>{dict.contact.cvTitle}</h3>
        <p>{dict.contact.cvPending}</p>
      </Section>
    </>
  );
}
