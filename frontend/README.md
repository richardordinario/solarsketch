# SolarSketch

A frontend-only virtual lab for learning solar PV installation. Everything runs and is stored in the
browser (IndexedDB); there is no backend. Architecture and conventions: `../CLAUDE.md`. Product spec:
`../docs/prd.md`.

## Develop

```bash
npm ci
npm run dev       # Vite dev server
npm test          # vitest
npm run lint      # oxlint
npm run build     # type-check + production build into dist/
npx vite preview  # serve dist/ (service worker, offline mode and the CSP only apply here)
```

Node 20.19 or newer.

## Deploy to Vercel

The app is a static site. `vercel.json` in this folder sets the build (`npm ci`, `npm run build`,
output `dist`), security headers and caching.

- **From Git:** import the repository and set **Root Directory** to `frontend`. No environment
  variables are needed.
- **From the CLI:** run `npx vercel` in this folder (`npx vercel --prod` for production).

Routing is hash-based (`#/lab`, `#/learn`, …), so no rewrites are needed. The hashed Content Security
Policy is injected into `index.html` as a meta tag at build time; `vercel.json` adds the header-only
directives (`frame-ancestors`, `X-Frame-Options` and the others). `dist/_headers` is for Netlify or
Cloudflare Pages and is ignored by Vercel; keep its header list in step with `vercel.json`.
