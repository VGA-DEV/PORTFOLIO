import { DialArt } from './DialArt';
import { WatchFrame } from './WatchFrame';
import { WatchStage } from './WatchStage';

type HeroProps = {
  name: string;
  role: string;
  intro: string;
  cta: { projects: string; contact: string };
  captions: readonly string[];
  engraving: readonly string[];
};

export function Hero({ name, role, intro, cta, captions, engraving }: HeroProps) {
  return (
    <section aria-labelledby='hero-title' className='hero' data-hero data-watch-section>
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
          <WatchStage captions={captions} engraving={engraving}>
            <DialArt />
            <WatchFrame />
          </WatchStage>
        </div>
      </div>
    </section>
  );
}
