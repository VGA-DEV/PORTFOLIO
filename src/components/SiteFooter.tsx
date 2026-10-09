import Image from 'next/image';

type SiteFooterProps = {
  rights: string;
  logoAlt: string;
};

export function SiteFooter({ rights, logoAlt }: SiteFooterProps) {
  return (
    <footer className='site-footer'>
      <div className='container site-footer__inner'>
        <Image
          className='site-footer__logo'
          src='/images/logo-vga-dev-light.webp'
          alt={logoAlt}
          width={598}
          height={364}
        />
        <p>
          © {new Date().getFullYear()} {rights}
        </p>
      </div>
    </footer>
  );
}
