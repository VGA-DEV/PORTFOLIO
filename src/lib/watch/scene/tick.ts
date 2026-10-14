/** Let the browser breathe between heavy steps, so setup never blocks scrolling or input. */
export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
