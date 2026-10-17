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

Static files only, on Apache. `public/.htaccess` is copied to the root of `out/` and holds the server rules: HTTPS and `www` to the bare domain in one redirect, `404.html` as the error page, MIME types (the worker must be JavaScript), gzip or brotli (without it mobile LCP goes from about 2.5 s to about 4.9 s), long caching for `/_next/static/`, `no-cache` for the pages and the worker, and a few safety headers. If the domain changes, edit it there and in `content/profile.json`.

To publish from the hosting panel:

1. `npm run build`, then `npm run package`. This writes `deploy/vga-dev-site.zip` with the content of `out/` at its root (forward slashes in the entry names, `.htaccess` included).
2. In the panel's file manager, turn on *show hidden files* (`.htaccess` starts with a dot), keep a copy of what is there now, and empty the site's folder.
3. Upload the zip to that folder and extract it there. The `.htaccess` must end up next to `index.html`.
4. Check `/`, `/es/`, `/en/`, a wrong address (it must show the 404 page), `http://` and `www.` (both must end at `https://vga-dev.es/`), and the response headers (`curl -I https://vga-dev.es/es/` should show `content-encoding` and `cache-control: no-cache`).

If the site answers with a 500 error after the upload, the host does not allow something in `.htaccess`: the first line to remove is `Options -Indexes`.

## Previous versions

Version 1 (Angular) is kept in the git tag `v1-angular`. It is not deployed.
