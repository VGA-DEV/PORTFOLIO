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
- `src/lib/` – the 3D watch (`watch/`), the section transitions and small shared helpers (`math`, `media`, `duration`, `metric-format`).
- `scripts/` – bundles the geometry web worker that `dev` and `build` run first.
- `src/i18n/` – locale configuration, dictionaries and content helpers.
- `content/` – texts (`messages/`), data and the evolution archive. Content lives here, not in components.
- `public/index.html` – root redirect to the browser language.

## Previous versions

Version 1 (Angular) is kept in the git tag `v1-angular`. It is not deployed.
