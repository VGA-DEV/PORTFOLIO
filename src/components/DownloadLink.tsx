'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A download button for a PDF. Its arrow bobs when pointed at, and on click it turns into a tick for
 * a moment and a polite message tells screen readers that the download started.
 */
export function DownloadLink({
  href,
  label,
  started,
}: {
  href: string;
  label: string;
  /** Said to screen readers when the download starts. */
  started: string;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = () => {
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 2200);
  };

  return (
    <a className='cv-link' href={href} download onClick={onClick} data-done={done ? 'true' : undefined}>
      {label}
      <span className='cv-link__tag' aria-hidden='true'>
        PDF
      </span>
      <svg className='cv-link__icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'>
        <path className='cv-link__arrow' d='M8 2v9M4.5 7.5L8 11l3.5-3.5M3 14h10' />
        <path className='cv-link__tick' d='M3.5 8.5l3 3 6-7' />
      </svg>
      <span className='sr-only' role='status'>
        {done ? started : ''}
      </span>
    </a>
  );
}
