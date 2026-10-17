'use client';

import { useEffect, useState } from 'react';

/**
 * The CV link of the header. The hero stays clean, so the link is out of sight (and out of the tab order)
 * while the hero is on screen and comes in once the visitor has moved past it. Without JavaScript it is
 * always shown (see the `noscript` style in the layout).
 */
export function HeaderCv({ href, label, name }: { href: string; label: string; name: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const watch = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting));
    watch.observe(hero);
    return () => watch.disconnect();
  }, []);

  return (
    <li className='site-header__cv' data-show={show ? 'true' : 'false'}>
      <a href={href} download aria-label={name}>
        {label}
        <svg viewBox='0 0 16 16' width='12' height='12' aria-hidden='true' focusable='false'>
          <path d='M8 2v9M4.5 7.5L8 11l3.5-3.5M3 14h10' />
        </svg>
      </a>
    </li>
  );
}
