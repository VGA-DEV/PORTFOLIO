import { DialArt } from './DialArt';
import { HeroWatch } from './HeroWatch';
import { WatchFrame } from './WatchFrame';

type HeroProps = {
  name: string;
  role: string;
  intro: string;
  cta: { projects: string; contact: string };
};

export function Hero({ name, role, intro, cta }: HeroProps) {
  return (
    <section
      aria-labelledby='hero-title'
      className='hero'
      data-hero
      data-watch-section
      data-side='left'
    >
      <div className='hero__stage'>
        <div className='container hero__grid'>
          <div className='hero__text'>
            <h1 id='hero-title' className='hero__name'>
              {name}
            </h1>
            <p className='hero__role'>{role}</p>
            <p className='hero__intro'>{intro}</p>
            <p className='hero__actions'>
              <a className='button button--solid' href='#projects'>
                {cta.projects}
              </a>
              <a className='button' href='#contact'>
                {cta.contact}
              </a>
            </p>
          </div>
          <HeroWatch>
            <DialArt />
            <WatchFrame />
          </HeroWatch>
        </div>
      </div>
    </section>
  );
}
