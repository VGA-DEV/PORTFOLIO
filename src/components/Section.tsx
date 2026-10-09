import type { ReactNode } from 'react';
import { DecoRule } from './DecoRule';

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  /** `stage` is the dark variant that bookends the page. */
  tone?: 'paper' | 'stage';
  children?: ReactNode;
};

export function Section({ id, title, intro, tone = 'paper', children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`section section--${tone}`}
    >
      <div className='container'>
        <header className='section__head'>
          <h2 id={`${id}-title`} className='section__title'>
            {title}
          </h2>
          <DecoRule className='section__rule' />
        </header>
        {intro ? <p className='section__intro'>{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
