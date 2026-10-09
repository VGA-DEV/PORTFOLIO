import { Hero } from '@/components/Hero';
import { Section } from '@/components/Section';
import { getProfile, getStack } from '@/i18n/content';
import { getDictionary, getLocale } from '@/i18n/dictionaries';

const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const profile = getProfile();
  const stack = getStack(locale);

  return (
    <>
      <Hero
        name={dict.hero.name}
        role={dict.hero.role}
        intro={dict.hero.intro}
        cta={dict.hero.cta}
        zones={dict.hero.zones}
        legend={dict.hero.legend}
      />

      <Section id='projects' title={dict.projects.title} intro={dict.projects.intro}>
        <ol className='ledger'>
          {dict.projects.items.map((project) => (
            <li key={project.name} className='ledger__row'>
              <h3 className='ledger__title'>{project.name}</h3>
              <div className='ledger__body'>
                <p>{project.summary}</p>
                <dl className='ledger__meta'>
                  <div>
                    <dt>{dict.projects.statusLabel}</dt>
                    <dd className='status'>
                      {
                        dict.projects.status[
                          project.status as keyof typeof dict.projects.status
                        ]
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>{dict.projects.stackLabel}</dt>
                    <dd>{project.stack.join(', ')}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id='experience'
        title={dict.experience.title}
        intro={dict.experience.intro}
      >
        <ol className='ledger ledger--dated'>
          {dict.experience.items.map((job) => (
            <li key={job.company} className='ledger__row'>
              <p className='ledger__period'>{job.period}</p>
              <div className='ledger__body'>
                <h3 className='ledger__title'>{job.company}</h3>
                <p className='ledger__role'>{job.role}</p>
                <p>{job.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id='stack' title={dict.stack.title}>
        <div className='stack'>
          {stack.map((group) => (
            <div key={group.id} className='stack__group'>
              <h3 className='stack__title'>
                {dict.stack.groups[group.id as keyof typeof dict.stack.groups]}
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

      <Section id='evolution' title={dict.evolution.title} intro={dict.evolution.intro}>
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
        title={dict.contact.title}
        intro={dict.contact.intro}
        tone='stage'
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
