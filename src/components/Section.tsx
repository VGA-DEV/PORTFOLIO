import type { ReactNode } from 'react';
import { DecoRule } from './DecoRule';

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  /** The part of the watch this section is told through; shown above the title on small screens, where the watch is only a faint background. */
  part?: string;
  /** Which side of the screen the text sits on; the watch takes the other. */
  side?: 'left' | 'right';
  /** `stage` is the dark variant that bookends the page; `mist` is a second light tone, so neighbours differ. */
  tone?: 'paper' | 'mist' | 'stage';
  /** Extra scroll after the section, during which it stays put while the watch moves on. */
  dwell?: boolean;
  /** Extra scroll before the dwell, during which the section stays put while its content swaps for other content. */
  lead?: boolean;
  /** `center` sets the heading and the intro on the middle of the column. */
  align?: 'start' | 'center';
  children?: ReactNode;
};

export function Section({
  id,
  title,
  intro,
  part,
  side = 'left',
  tone = 'paper',
  dwell = true,
  lead = false,
  align = 'start',
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`section section--${tone}${align === 'center' ? ' section--center' : ''}`}
      data-watch-section
      data-side={side}
    >
      <div className='plate' aria-hidden='true' />
      <div className='pin section__pin'>
        <div className='container'>
          <div className='section__body'>
            <header className='section__head'>
              {part ? (
                <p className='section__eyebrow' aria-hidden='true'>
                  {part}
                </p>
              ) : null}
              <h2 id={`${id}-title`} className='section__title'>
                {title}
              </h2>
              <DecoRule className='section__rule' />
            </header>
            {intro ? <p className='section__intro'>{intro}</p> : null}
            {children}
          </div>
        </div>
      </div>
      {lead ? <div className='lead' data-lead aria-hidden='true' /> : null}
      {dwell ? <div className='dwell' data-gap aria-hidden='true' /> : null}
    </section>
  );
}
