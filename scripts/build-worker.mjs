// Bundles the geometry worker into public/ so Next never has to bundle a Worker.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/lib/watch/build.worker.ts'],
  outfile: 'public/watch-geometry.worker.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  logLevel: 'warning',
});
