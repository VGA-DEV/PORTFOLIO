import type { ReactNode } from 'react';
import { DecoRule } from './DecoRule';

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  /** Which side of the screen the text sits on; the watch takes the other. */
  side?: 'left' | 'right';
  /** `stage` is the dark variant that bookends the page; `mist` is a second light tone, so neighbours differ. */
  tone?: 'paper' | 'mist' | 'stage';
  children?: ReactNode;
};

export function Section({
  id,
  title,
  intro,
  side = 'left',
  tone = 'paper',
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`section section--${tone}`}
      data-watch-section
      data-side={side}
    >
      <div className='plate' aria-hidden='true' />
      <div className='container'>
        <div className='section__body'>
          <header className='section__head'>
            <h2 id={`${id}-title`} className='section__title'>
              {title}
            </h2>
            <DecoRule className='section__rule' />
          </header>
          {intro ? <p className='section__intro'>{intro}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
