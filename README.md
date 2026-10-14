# Portfolio

Personal portfolio of Víctor Manuel Gómez Álvarez. Next.js (App Router, TypeScript), static export, Spanish and English.

## Commands

```bash
npm install
npm run dev        # development server
npm run build      # static export to ./out
npm run lint
npm run typecheck
```

## Structure

- `src/app/[lang]/` – layout and home page, one route per language (`/es/`, `/en/`).
- `src/app/[lang]/styles/` – the stylesheet, split by area. The import order in `layout.tsx` is the cascade order: keep it.
- `src/components/` – small reusable components.
- `src/lib/` – the 3D watch, the section transitions and small shared helpers (`math`, `media`, `duration`, `metric-format`). The watch is split by responsibility:
  - `watch/scene/` – the WebGL scene: `index.ts` (state and render loop), `shaders`, `deferred-program`, `materials`, `poses` (one pose per section), `framing` (camera and orbit maths), `kit` (meshes and layers), `parts` (case, strap, dial, movement, hands), `props` (the miniatures), `anchor` (scene → screen pixels).
  - `watch/placement/` – the page side, in pure functions: where the note and the crown control sit (`note`, `crown`), how far along the watch is (`progress`), and small DOM readers (`scan`, `device`, `excite`, `space`).
  - `watch/build.ts`, `geometry.ts`, `smooth.ts`, `dial.ts` – the geometry (built in a web worker) and the painted textures.
- `scripts/` – bundles the geometry web worker that `dev` and `build` run first.
- `src/i18n/` – locale configuration, dictionaries and content helpers.
- `content/` – texts (`messages/`), data and the evolution archive. Content lives here, not in components.
- `public/index.html` – root redirect to the browser language.

## Previous versions

Version 1 (Angular) is kept in the git tag `v1-angular`. It is not deployed.
