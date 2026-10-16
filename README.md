# m³

m³ (pronounced M-cubed: Modular Machine Management) is a modular vending machine for VMI vendors, primarily of industrial PPE and MRO supplies, and the sites they serve. Every slot has the same universal fitment, and modular shelves (modules) plug in and out of any slot. Each module is filled with a set quantity of inventory and carries a placard on its front naming the product inside. Every module is swapped at every restock regardless of consumption: full modules go in, and used modules go back to the vendor. m³ intentionally does not track usage. Consumption is determined back at the VMI vendor's warehouse, a controlled environment, where returned modules are counted and RMAs and invoices are issued as needed. The enclosure is injection-molded plastic and low-voltage powered: durable, yet inexpensive to make and maintain.

This repository is m³'s single-page product spec site. It is built around a real-time, procedurally modeled m³ at true scale (three.js), choreographed on scroll with GSAP ScrollTrigger and Lenis. The model, the spec table's computed rows and the module gallery all come from one config file.

**Live site:** https://carterbkeeling.github.io/M3/ (after the first deploy)

## Quick start (Windows)

You need **Node 24 LTS**. `.nvmrc` says `24`, and `engines.node` is `>=22.19.0` because Lighthouse needs it. Check your version with `node --version`.

**PowerShell note:** the default execution policy blocks `npm.ps1`, so call `npm.cmd` and `npx.cmd` instead. Don't change the execution policy. In Git Bash or cmd, plain `npm` and `npx` work.

```powershell
npm.cmd ci              # install the exact locked dependencies
npm.cmd run dev         # dev server: http://localhost:5173/M3/
npm.cmd test            # unit tests (Vitest)
npm.cmd run build       # type-check (tsc -b) and production build into dist/
npm.cmd run preview     # serve the production build: http://localhost:4173/M3/
```

The site lives under the base path **`/M3/`** in dev, preview and production, and GitHub Pages paths are case-sensitive. Runtime URLs go through `import.meta.env.BASE_URL`.

Playwright drives the **Microsoft Edge already installed on Windows** (`channel: 'msedge'`), so no browser download is needed.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Vite dev server on port 5173 (`/M3/`). HTML comments and DRAFT markers are kept, and there is no CSP. |
| `build` | `tsc -b && vite build`. Production build into `dist/`: comments stripped, meta CSP added, absolute share and canonical URLs. It warns when the rendered stills are stale. |
| `preview` | Serves `dist/` on port 4173 (`/M3/`), exactly as it ships. |
| `test` | Vitest unit tests (`tests/unit`): grid sizes, stroke segments, placards and derived spec rows. |
| `test:e2e` | Playwright e2e tests against the production build (`tests/e2e`): clean console, nav links land on their sections, share and SEO tags. Builds and starts the preview if it isn't running. |
| `copy:review` | Regenerates `COPY-REVIEW.md` from the sources. |
| `check:copy` | `copy:review --final`: also fails if any string is still draft, a truth line has no source, or a string is empty. CI runs it before every deploy. |
| `capture:blockout` | Phase 1 model variant captures from `lab.html` → `docs/checkpoints/phase-1/`. |
| `capture:reference` | The landonorris.com reference study → `reference/` (gitignored, never committed). |
| `capture:page` | Screenshots of every section at 1440 px and 390 px (with `?static`) → `docs/checkpoints/phase-3/page-*.jpg`. |
| `render:assets` | Renders the no-WebGL stills, gallery card art and OG image into `public/` and stamps `public/stills/manifest.json` with a hash of `config.ts`. |
| `export:glb` | Exports the machine at rest to `public/m3.glb` with three's GLTFExporter (not linked from the page). |
| `lh` | Lighthouse: desktop median of 3 (gated) plus one mobile run (reported). See [Lighthouse](#lighthouse). |

Other Playwright specs run directly, for example `npx.cmd playwright test tests/capture/paths.spec.ts` for the default, reduced-motion and no-WebGL path screenshots on the production build (`docs/checkpoints/phase-3/`). The others are `interaction` (hover, open, pull, keyboard and drag in the hero), `materials` (material and placard close-ups), `wordmarks`, `smoke` and the `sheets*` contact sheets.

## Edit the machine: `src/model/config.ts`

`config.ts` is the one file that defines the machine. Units are meters, at true scale. The model, the spec table's dimension and slot rows, the dimension drawing and the module gallery all read from it.

| Field | What it controls |
|---|---|
| `grid: { cols, rows }` | The slot grid (default 2 × 6 = 12 slots). The cabinet resizes, and the accent stroke regenerates with exactly one light segment per slot. |
| `slot`, `cabinet`, `radius`, `wall` | The opening size (fixed by the universal fitment), header, plinth, mullion, side frames, rails, depth and the radius family. Outer dimensions come from `outerDims()` in `src/model/dims.ts`. |
| `door.style` | `'side'` (approved: side-hinged on the left, finger pocket at the free edge) or `'drop'` (bottom-hinged, kept as an option). |
| `colorway` | `'graphiteMatte'` (approved), `'carbonSatin'` or `'charcoalTwoTone'`. Colors are defined in `colorways` in the same file. The accent stroke is always Pipe Cyan `#12D6FF`. |
| `stroke.path` | `'spine'` (approved: one stroke down the center mullion, one S per row, reader mid-spine) or `'serpentine'` (kept as an option). |
| `modules` | One `{ product, packed }` per module. Placards read the product name and "Packed: N". Modules fill slots row-major from the top left. Extras beyond `cols × rows` are ignored, and unfilled slots render empty (fitment visible, light dim). |

After editing `config.ts`:

1. Run `npm.cmd test`.
2. Run `npm.cmd run render:assets` and `npm.cmd run export:glb`. The stills, OG image and GLB are rendered from the model, and the build warns when they no longer match `config.ts`. Gallery names and quantities are DOM text, so they never go stale.
3. Run `npm.cmd run copy:review`, because placard text is listed in COPY-REVIEW.

## Specs: `src/content/specs.ts`

- `specRows()` builds the spec table. The **dimensions** and **slots** rows are computed from `config.ts`, so the table, the drawing and the model always agree. Dimensions print as approximate, for example "≈ 72 × 39 × 35 in · 1.83 × 0.99 × 0.89 m".
- A row whose `value` is **`null` renders a TBD chip**. An optional `tbdHint` shows what is already known (for example "Low-voltage" beside the power TBD). To fill in a spec, replace `null` with the text.
- The **price row** (`id: 'price'`, "$15,000 retail") is the only place the price appears.
- Wording that goes beyond Product truth gets `draft: true`, which marks it `<!-- DRAFT -->`. Once approved, it also gets `approved: 'YYYY-MM-DD'`.
- The contact address is `CONTACT_EMAIL` in `src/content/site.ts`. While it is `null`, the CTA shows a TBD chip and is `aria-disabled`. `SITE_URL` in the same file drives the canonical and Open Graph URLs.

## Copy workflow

- Every string on the page has a stable copy ID. Static text is tagged `data-copy="ID"` in `index.html`. JS-only strings (announcements, hotspot labels, alt text) live in `src/content/copy.ts`. Generated strings come from `specs.ts`, the gallery and the placards in `config.ts`.
- Each string is **truth** (a Product truth, brief or decision paraphrase, with its source), **draft**, **approved** or **UI** (labels with no claims).
- **Markers:** a draft string in `index.html` has a literal `<!-- DRAFT -->` beside it. To approve it, replace that with `<!-- APPROVED YYYY-MM-DD -->`. In `copy.ts`, set `status: 'approved'` and `approved: 'YYYY-MM-DD'`. Spec rows use the `approved` field. Generated gallery and placard strings are approved in the `APPROVED` map in `scripts/copy-review.ts`.
- `COPY-REVIEW.md` is generated, so don't edit it by hand. Run `npm.cmd run copy:review` and review its Draft section, which lists each remaining draft with its file and line.
- `npm.cmd run check:copy` regenerates the file and fails while any draft remains. The deploy workflow runs it before building, so nothing ships unapproved. HTML comments, markers included, are stripped from the production build.

## Dev pages and URL flags

- **`lab.html`** (http://localhost:5173/M3/lab.html, dev only, not built): the model alone with orbit controls, using the production materials. URL overrides layer on top of `config.ts` for captures only: `?colorway=`, `door=side|drop`, `stroke=spine|serpentine`, `state=closed|open|pulled`, `slot=N`, `view=front|threequarter|side|back|ortho`, `bg=dark|light`, `grid=CxR`, `modules=all|one|none`, `clean=1`, plus lab-only `name=…&packed=…` and `scale=1`. Approved choices go into `config.ts`.
- **`wordmarks.html`** (dev only): the m³ wordmark specimen. The approved mark is **Slot** (`src/brand/wordmark.ts`).
- **`render.html`** (dev only, not built): the asset renderer behind `render:assets` and `export:glb`. It poses the model like the page's scenes and exposes `window.__m3render`.
- **Page flags:** `?nowebgl` forces the no-WebGL path (chosen at startup, before the first layout: no pins, rendered stills whose alt text replaces the scenes' text equivalents, and the SVG elevation). The page also switches to that path, and re-measures, if the 3D stage fails to load or start after the WebGL2 probe passed. `?debug` shows a frame readout over the last 120 frames: the frame interval (median and p95, vsync-bound), the CPU work per frame (p95) and the dropped-frame count. `?static` (or `?skipintro`) skips the intro loader and the scroll reveals, for captures and audits. The reduced-motion path follows the OS `prefers-reduced-motion` setting.
- **Intro loader:** plays once per browser session (`sessionStorage`), lasts at most 1.2 s, and any key, click or scroll skips it. The page behind it is inert until it opens, so Tab only reaches its skip button. With reduced motion it is a short fade.

## Captures

Capture specs live in `tests/capture/` and run through Playwright on the installed Edge. `playwright.config.ts` starts the dev server (5173) and the production preview (4173), and reuses either one if it's already running. Captures run against the dev server, and e2e tests run against the preview. Committed screenshots go in `docs/checkpoints/phase-N/`. The landonorris.com reference captures stay in the gitignored `reference/` folder.

## Lighthouse

```powershell
npm.cmd run lh
```

`scripts/lighthouse.ts` (run directly with Node 24's type stripping):

- Uses the production preview at http://localhost:4173/M3/. If nothing is serving there, it runs `vite build` and `vite preview --port 4173 --strictPort` itself and stops that preview when it's done.
- Launches the installed Edge **headed** (a window opens; leave it alone while it runs) through Playwright, with DevTools port **9333**, which must be free. Headed Edge uses the real GPU, so the WebGL page is what gets scored.
- Runs Lighthouse 13 with the **desktop preset 3 times** and reports the per-metric median of Performance, Accessibility, Best Practices, SEO, LCP, TBT and CLS. It then makes **one mobile run**, which is reported but not gated.
- **After each run** it opens the page in the same browser and **fails unless `document.documentElement.dataset.gl === 'webgl2'`**, so the fallback path is never scored by mistake. It also records whether the run itself loaded the 3D stage chunk.
- **Gate:** it exits non-zero if the desktop median Performance is below 80 or Accessibility is below 95.
- **Reports** go in `reports/` (gitignored): `lh-desktop-1..3.html/.json`, `lh-mobile.html/.json` and `lh-summary.json`.
- The browser profile lives in `node_modules/.tmp/lighthouse` instead of `%TEMP%`. This works around the Windows EPERM error that occurs when a locked profile is cleaned up.

Last run (2026-10-16, Edge 155, AMD Radeon 740M integrated GPU): desktop median **Performance 95, Accessibility 100, Best Practices 100, SEO 100** (LCP 0.44 s, TBT 186 ms, CLS 0). The first, cold-cache run scores lower (75) because shader compilation on first load blocks the main thread for about 0.6 s. Mobile, not gated: Performance 86.

## Deploy to GitHub Pages

The site deploys from `.github/workflows/deploy.yml`, which is Vite's GitHub Pages workflow split into two jobs:

- **build:** checkout, Node from `.nvmrc` with the npm cache, `npm ci --ignore-scripts` (no dependency needs an install script), `npm run check:copy`, `npm run build`, configure-pages, then upload `./dist` as the Pages artifact.
- **deploy:** deploy-pages into the `github-pages` environment.

It runs on every push to `main` and manually from the Actions tab (`workflow_dispatch`). Deployments queue rather than cancel each other (`concurrency: pages`).

1. **Before the first push:** in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Push to `main`, or run the workflow from the Actions tab.
3. The site is served at **https://carterbkeeling.github.io/M3/**.

The base path `/M3/` is set in `vite.config.ts`, and the absolute share and canonical URLs come from `SITE_URL` in `src/content/site.ts`. If the repo name or owner changes, update both.

**Security:** each third-party action is pinned to a full commit SHA, with its release tag in a comment. Permissions are deny-by-default and granted per job: build gets `contents: read` and `pages: read`, and deploy gets `pages: write` and `id-token: write`. No secrets are used. To update an action, resolve the new release tag to its commit SHA and update both the pin and the comment. The production page carries a strict meta CSP (`script-src 'self'`, `style-src 'self'`, no third-party requests), and it is added only in production builds.

## Licenses

- **GSAP** (core, ScrollTrigger, DrawSVG and CustomEase) is free for commercial use under the **GSAP Standard License** (https://gsap.com/standard-license). It is **not** OSI open source.
- **Fonts:** M PLUS Rounded 1c and JetBrains Mono are both under the **SIL Open Font License 1.1**. They are self-hosted via @fontsource, and their license texts ship in the packages.
- three.js, Lenis and Vite are MIT. Lighthouse and Playwright (dev only) are Apache-2.0.
- This repository has no LICENSE file, so it is all rights reserved unless decided otherwise.

## Open TBD list

- **Contact email:** `CONTACT_EMAIL` in `src/content/site.ts`. The CTA shows a TBD chip until it is set.
- **Power input:** the spec row is TBD (known: low-voltage).
- **Connectivity type:** the spec row is TBD.
- **Resin:** the spec row is TBD (known: injection-molded plastic).
- **Weight:** the spec row is TBD.
- **Module capacity:** the spec row is TBD.
- **Warranty:** the spec row is TBD.
- **Confirmed final dimensions:** currently ≈ 72 × 39 × 35 in · 1.83 × 0.99 × 0.89 m, marked approximate and computed from `config.ts`.
- **Placard quantities:** illustrative; the page says so.
- **Repo owner and visibility:** to be confirmed before the first push (assumed public `carterbkeeling/M3`). This includes whether PLAN.md, COPY-REVIEW.md and `docs/checkpoints/` stay in the pushed branch.
- **Reader reach height:** *resolved.* The reader moved mid-spine to the rail nearest the grid's mid-height, ≈ 35 in on the default 2 × 6, inside the 15–48 in reach range.
