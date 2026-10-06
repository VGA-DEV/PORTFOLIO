import type { ReactNode } from 'react';

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  children?: ReactNode;
};

export function Section({ id, title, intro, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className='section'>
      <div className='container'>
        <h2 id={`${id}-title`} className='section__title'>
          {title}
        </h2>
        {intro ? <p className='section__intro'>{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
