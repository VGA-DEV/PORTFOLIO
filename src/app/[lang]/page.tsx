import { Section } from '@/components/Section';
import { getProfile, getStack } from '@/i18n/content';
import { getDictionary, getLocale } from '@/i18n/dictionaries';

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const profile = getProfile();
  const stack = getStack(locale);

  return (
    <>
      <section aria-labelledby='hero-title' className='hero'>
        <div className='container'>
          <h1 id='hero-title' className='hero__name'>
            {dict.hero.name}
          </h1>
          <p className='hero__role'>{dict.hero.role}</p>
          <p className='hero__intro'>{dict.hero.intro}</p>
        </div>
      </section>

      <Section id='projects' title={dict.projects.title} intro={dict.projects.intro}>
        <ul className='cards'>
          {dict.projects.items.map((project) => (
            <li key={project.name} className='card'>
              <h3 className='card__title'>{project.name}</h3>
              <p>{project.summary}</p>
              <dl className='card__meta'>
                <div>
                  <dt>{dict.projects.statusLabel}</dt>
                  <dd>
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
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id='experience'
        title={dict.experience.title}
        intro={dict.experience.intro}
      >
        <ul className='cards'>
          {dict.experience.items.map((job) => (
            <li key={job.company} className='card'>
              <h3 className='card__title'>{job.company}</h3>
              <p className='card__sub'>
                {job.role} · {job.period}
              </p>
              <p>{job.summary}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id='stack' title={dict.stack.title}>
        <div className='cards'>
          {stack.map((group) => (
            <div key={group.id} className='card'>
              <h3 className='card__title'>
                {dict.stack.groups[group.id as keyof typeof dict.stack.groups]}
              </h3>
              <ul className='tags'>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id='evolution' title={dict.evolution.title} intro={dict.evolution.intro}>
        <ul className='cards'>
          {dict.evolution.versions.map((version) => (
            <li key={version.tag} className='card'>
              <h3 className='card__title'>{version.name}</h3>
              <p>{version.summary}</p>
              <p className='card__sub'>
                {dict.evolution.tagLabel}: <code>{version.tag}</code>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id='contact' title={dict.contact.title} intro={dict.contact.intro}>
        <ul className='links'>
          <li>
            <a href={`mailto:${profile.email}`}>
              {dict.contact.email}: {profile.email}
            </a>
          </li>
          <li>
            <a href={profile.linkedin} rel='noopener noreferrer' target='_blank'>
              {dict.contact.linkedin}
            </a>
          </li>
          <li>
            <a href={profile.github} rel='noopener noreferrer' target='_blank'>
              {dict.contact.github}
            </a>
          </li>
        </ul>
        <h3 className='card__title'>{dict.contact.cvTitle}</h3>
        <p>{dict.contact.cvPending}</p>
      </Section>
    </>
  );
}
