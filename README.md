# Portfolio

Personal portfolio of Víctor Manuel Gómez Álvarez. Next.js (App Router, TypeScript), static export, Spanish and English.

A 3D Art Deco wristwatch sits fixed behind the page and moves to the piece each section is about. The 3D is progressive enhancement: without JavaScript, without WebGL2, with reduced motion, on data saver or on a weak device, the page is the same content with a flat SVG watch.

## Commands

```bash
npm install
npm run dev        # development server
npm run build      # static export to ./out
npm run lint
npm run typecheck
```

`dev` and `build` first bundle the geometry web worker (`scripts/build-worker.mjs` → `public/watch-geometry.worker.js`, generated and not committed). Do not run `build` while `dev` is running: they share `.next`.

## Structure

- `src/app/[lang]/` – layout and home page, one route per language (`/es/`, `/en/`).
- `src/app/[lang]/styles/` – the stylesheet, split by area. The import order in `layout.tsx` is the cascade order: keep it.
- `src/components/` – small reusable components.
- `src/lib/` – the 3D watch, the section transitions and small shared helpers (`math`, `media`, `duration`, `metric-format`). The watch is split by responsibility:
  - `watch/scene/` – the WebGL scene: `index.ts` (state and render loop), `shaders`, `deferred-program`, `materials`, `poses` (one pose per section), `framing` (camera and orbit maths), `kit` (meshes and layers), `parts` (case, strap, dial, movement, hands), `props` (the miniatures), `anchor` (scene → screen pixels).
  - `watch/placement/` – the page side, in pure functions: where the note and the crown control sit (`note`, `crown`), how far along the watch is (`progress`), and small DOM readers (`scan`, `device`, `excite`, `space`).
  - `watch/build.ts`, `geometry.ts`, `smooth.ts`, `dial.ts` – the geometry (built in a web worker) and the painted textures.
- `scripts/` – bundles the geometry web worker.
- `src/i18n/` – locale configuration, dictionaries and content helpers.
- `content/` – texts (`messages/{es,en}.json`), data (`stack.json`, `profile.json`), the evolution archive (`evolution/`) and the provenance notes of the images (`provenance/`). Content lives here, not in components: every visible text, in both languages, is in `messages/`.
- `public/` – static files: `index.html` (root page that redirects to the browser language), the Open Graph images (`og-es.jpg`, `og-en.jpg`, 1200×630) and the logo.

## Editing content

- A project, a job or a stack item: its entry in `content/messages/*.json` (both languages) or `content/stack.json`.
- A version in the Evolution section: its entry in `content/evolution/metrics.json` and in `evolution.versions` of both dictionaries.
- CVs: drop `cv-victor-gomez-es.pdf` and `cv-victor-gomez-en.pdf` in `public/cv/`; the download buttons appear when the files exist.
- If a section's design changes, serve `out/` locally, run `node scripts/capture-evolution.mjs` to take new viewport captures into `content/evolution/v2/` and then `node scripts/crop-evolution.mjs` to cut the pairs of the design comparer in Evolution (`content/evolution/compare.json` holds the regions).
- If the hero changes, regenerate `public/og-*.jpg` (a screenshot of the hero at 1200×630, without the header and the crown control).

## Hosting

Static files only. The host should serve gzip or brotli (without it mobile LCP goes from about 2.5 s to about 4.9 s) and long caching for `/_next/static/`. `/` is a plain HTML page that redirects by browser language, so no server rules are needed.

## Previous versions

Version 1 (Angular) is kept in the git tag `v1-angular`. It is not deployed.
