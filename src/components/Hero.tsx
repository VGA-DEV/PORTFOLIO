import Image from 'next/image';

type HeroProps = {
  name: string;
  role: string;
  intro: string;
  logoAlt: string;
};

export function Hero({ name, role, intro, logoAlt }: HeroProps) {
  return (
    <section aria-labelledby='hero-title' className='hero'>
      <div className='container hero__inner'>
        <div className='hero__text'>
          <h1 id='hero-title' className='hero__name'>
            {name}
          </h1>
          <p className='hero__role'>{role}</p>
          <p className='hero__intro'>{intro}</p>
        </div>
        <Image
          className='hero__logo'
          src='/images/logo-vga-dev.webp'
          alt={logoAlt}
          width={598}
          height={364}
          priority
        />
      </div>
    </section>
  );
}
