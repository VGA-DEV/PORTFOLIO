/** Art Deco frame for the watch stage: a double rule with stepped corners. */
export function WatchFrame() {
  return (
    <svg
      className='watch__frame'
      viewBox='0 0 100 100'
      preserveAspectRatio='none'
      aria-hidden='true'
      focusable='false'
    >
      <path d='M7 0H93V2.4H96.4V5.4H100V95H96.4V97.6H93V100H7V97.6H3.6V94.6H0V5H3.6V2.4H7Z' />
      <path
        className='watch__frame-inner'
        d='M8.4 2.6H91.6V4.8H94.6V7.4H97.4V92.6H94.6V95.2H91.6V97.4H8.4V95.2H5.4V92.6H2.6V7.4H5.4V4.8H8.4Z'
      />
    </svg>
  );
}
