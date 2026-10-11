/**
 * A stretch of scroll between two sections that shows nothing but the watch moving
 * and the background sweeping round. It gives every transition a known start and end,
 * so the 3D can be paced against it. Only shown once the sweep is running.
 */
export function TransitionGap() {
  return <div className='gap' data-gap aria-hidden='true' />;
}
