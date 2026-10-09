import { DialArt } from './DialArt';
import { ExplodedArt } from './ExplodedArt';
import { HeroLegend } from './HeroLegend';
import { WatchFrame } from './WatchFrame';
import { WatchStage } from './WatchStage';

type HeroProps = {
  name: string;
  role: string;
  intro: string;
  cta: { projects: string; contact: string };
  zones: { madrid: string; dublin: string };
  legend: { title: string; items: { part: string; tech: string }[] };
};

export function Hero({ name, role, intro, cta, zones, legend }: HeroProps) {
  return (
    <section aria-labelledby='hero-title' className='hero' data-hero>
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
            <HeroLegend className='hero__legend' title={legend.title} items={legend.items} />
          </div>
          <WatchStage madridLabel={zones.madrid} dublinLabel={zones.dublin}>
            <DialArt />
            <WatchFrame />
          </WatchStage>
        </div>
      </div>
      <div className='container hero__anatomy'>
        <ExplodedArt />
        <HeroLegend title={legend.title} items={legend.items} />
      </div>
    </section>
  );
}
