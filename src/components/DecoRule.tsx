/** Art Deco divider: a double rule broken by a stepped diamond. Decorative. */
export function DecoRule({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 320 14'
      width='320'
      height='14'
      aria-hidden='true'
      focusable='false'
    >
      <g fill='none' stroke='currentColor' strokeWidth='1'>
        <path d='M0 5.5H138M0 8.5H138' />
        <path d='M182 5.5H320M182 8.5H320' />
        <path d='M160 0.5L173 7L160 13.5L147 7Z' />
        <path d='M160 4L167 7L160 10L153 7Z' fill='currentColor' />
      </g>
    </svg>
  );
}
