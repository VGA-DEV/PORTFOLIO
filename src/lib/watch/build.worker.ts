import { bufferList, buildWatchPieces } from './build';

self.onmessage = () => {
  const pieces = buildWatchPieces();
  (self as unknown as Worker).postMessage(pieces, bufferList(pieces));
};
