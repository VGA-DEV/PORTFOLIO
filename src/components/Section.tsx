import type { ReactNode } from 'react';
import { DecoRule } from './DecoRule';

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  /** Why this section is told through one piece of the watch. */
  note?: { part: string; text: string };
  /** Which side of the screen the text sits on; the watch takes the other. */
  side?: 'left' | 'right';
  /** `stage` is the dark variant that bookends the page. */
  tone?: 'paper' | 'stage';
  children?: ReactNode;
};

export function Section({
  id,
  title,
  intro,
  note,
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
      <div className='container'>
        <div className='section__body'>
          <header className='section__head'>
            <h2 id={`${id}-title`} className='section__title'>
              {title}
            </h2>
            <DecoRule className='section__rule' />
          </header>
          {note ? (
            <p className='section__note'>{note.text}</p>
          ) : null}
          {intro ? <p className='section__intro'>{intro}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
