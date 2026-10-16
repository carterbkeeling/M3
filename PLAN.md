# m³ product spec page: Plan

**Status:** Approved on 2026-10-15 (Phase 0 complete). Next: Phase 1, once Node 24 LTS is installed.
**Repo:** `C:\Users\CarterKeeling\Documents\M3` → GitHub repo M3 (owner and visibility confirmed before the first push; see Assumptions)
**Live URL (after final OK):** https://carterbkeeling.github.io/M3/

## Context
m³ is a modular, connected and deliberately non-counting vending machine for VMI vendors of PPE and MRO supplies. This project is a single-page product spec site built around a real-time, procedurally modeled 3D m³ at true scale. The page is choreographed around the model and borrows the *feel* of landonorris.com, with m³'s own palette, type and single-stroke ("Muni worm") curve language. The work runs in four phases, and each ends at a checkpoint where I stop and wait for you.

---

## Decisions
Your answers from the Phase 0 interview. "(default)" means you accepted the brief's recommendation.

| # | Decision | Answer |
|---|---|---|
| 1 | Where doors live | **On the module (default).** Each module is a closed unit with its own door, placard and lock, powered through the fitment's low-voltage connector. The whole unit swaps, door included. |
| 2a | Unlock method | **Badge or phone tap (default)** at one reader in the cabinet header. |
| 2b | Are openings logged? | **Yes.** The page says door openings are logged, framed as part of **access control** (not usage tracking). The exact line goes to COPY-REVIEW. |
| 3 | Alert triggers | **Default.** Restock alerts follow the vendor's restock schedule. Service alerts flag fitment or lock faults. |
| 4 | Cabinet size and grid | **Default.** About 72 in H × 39 in W × 35 in D (≈ 1.83 × 0.99 × 0.89 m), 2 columns × 6 rows = 12 slots. |
| 5 | Module sizes and contents | **One universal size, one product per module.** No double-height modules, no mixed kits. |
| 6 | Machine colorway | **Dark machine only.** Three dark colorways at Phase 1, each rendered on both page tones. The body and doors are dark in every variant, and the accent stroke is identical in all three. |
| 7a | Accent | **Pipe Cyan #12D6FF** (10.41:1 on graphite). On light sections the UI and large text use **#006E94** (5.01:1 on bone). Never use bright cyan as text on light backgrounds. |
| 7b | Palette | Graphite **#15161A**, Bone **#F3EFE7**, Graphite-60 **#7F8187** (hairlines, and captions on dark at 4.64:1), plus the accent. Small captions on light sections use **#5C5E63** (5.66:1 on bone). Graphite on bone is 15.76:1. |
| 7c | Type | **M PLUS Rounded 1c** (900 display, 500 subheads; latin subset) + **JetBrains Mono** (400 values, 500 caps labels). Both OFL, self-hosted via @fontsource, and both include ³ (U+00B3). |
| 8 | Spec values | **All TBD for now.** Power input, connectivity, resin, weight, module capacity and warranty each render as a visible TBD chip. |
| 9 | Price placement | **Spec sheet only.** The brief's separate Price section (#10) is **removed**. The spec table has a row reading "$15,000 retail". |
| 10 | Primary CTA | **mailto, address TBD (default).** The address lives in one spot (`src/content/site.ts`). |
| 11 | Stack and hosting | **Default stack. GitHub Pages from the M3 repo** via a GitHub Actions workflow, base path `/M3/`. |
| 12 | Existing assets | **None.** I design the m³ wordmark (three candidates at Phase 1). |
| 13 | Copy voice | **Plain engineering (default).** Confident, plain-spoken, short sentences. |
| A | Status light | **The accent stroke is the light.** The stretch of stroke that belongs to each slot is that slot's light: dim = no module, steady = module plugged in, a brief pulse and then a brighter hold while unlocked. This replaces the brief's separate small light per door. The stroke stays unbroken when doors open. Any page wording that names the light or explains its states is DRAFT and goes to COPY-REVIEW. The visual behavior is fixed. |
| B | Showing consumption | **Only at the warehouse.** On site, the swap shows closed modules only. The "Count" beat shows the returned module opened up, captioned with the idea "counted here, not on site". The brief's on-site cutaway is dropped. |
| C | Placard content | **Product name + labeled packed quantity** (e.g. "Packed: 100 pairs"). **No module ID**, which changes the brief's list. |
| D | Category name | **"Modular vending machine,"** with no payment or dispensing language. "A new kind of …" goes to COPY-REVIEW as a claim. |
| E | Dimensions on the spec sheet | **Printed, marked approximate** ("≈ 72 in · 1.83 m (approx.)"). The values are computed from config.ts, so the table and the drawing always agree. |
| F | Audience | **Both, by section.** Vendors are "you" where the business model is explained, and site staff are "you" where the day-to-day machine is shown (see the outline). |
| G | Node.js | **You install Node 24 LTS** before Phase 1 (the nodejs.org 24.x installer, or `winget install OpenJS.NodeJS.LTS`). I verify it with `node --version`. |
| H | Publishing | **Commit locally at every checkpoint, and push to GitHub only after final (Phase 3) approval** or when you say. |
| I | Reference study | One pass done in the browser pane during Phase 0. A full Playwright capture of landonorris.com happens at the start of Phase 1 and is kept in an **uncommitted** `reference/` folder. |

### Phase 1 checkpoint decisions (2026-10-15)
These supersede anything above or below that conflicts.

| # | Decision | Answer |
|---|---|---|
| P1 | Proportions | **Approved as built:** ≈ 72 × 39 × 35 in (1.828 × 0.99 × 0.89 m). Header 17 cm, plinth 10 cm, 2 × 6 slots with 41.0 × 24.3 cm openings, a **70 mm center mullion** (it carries the light-pipe spine), 50 mm side frames, 20 mm rails. |
| P2 | Door style | **A · side-hinged (left).** The door sits nearly flush (6 mm proud), with molded knuckles tucked inside its outline and a **molded stadium finger pocket** at the free edge. No exterior lock or key face: the **latch is on the inside face** and is visible only when the door is open. Style B (drop-down, recessed lip) is retained in code as an option only. |
| P3 | Curve language / stroke | **Spine.** One stroke down the center mullion with one compact S per row: the upper lobe is the left door's light and the lower lobe is the right door's. The rail serpentine is retained in code as an option only, with its header reader. |
| P4 | Reader placement | **Mid-spine, not in the header** (your direction). A capsule tap pad (≈ 36 × 96 mm) sits on the center mullion at the rail nearest the grid's mid-height (≈ 35 in on the default 2 × 6, inside the 15–48 in reach range). It is ringed by its own light ring, and the stroke flows into the ring above and out below; the stretch under the pad is hidden. The header carries only the start of the stroke (candidate home for the molded m³ mark; to propose in Phase 2). |
| P5 | Colorway | **Graphite Matte** (body #2A2C31, doors one step lighter). |
| P6 | Wordmark | **Slot** (`src/brand/wordmark.ts` → `wordmark`). A square m with one radius throughout and a superscript ³. Its loader draws the m, then the ³ (one pen lift). This differs from the brief's "draws itself as a single stroke"; you accepted it by choosing Slot. |
| P7 | Light states | Brightness only (one accent): dim = no module, steady = plugged in, bright = unlocked. The reader ring is its own light (it pulses on a tap in the unlock scene). |

### Phase 3 decisions (approved 2026-10-16)
These supersede anything above that conflicts.

| # | Decision | Answer |
|---|---|---|
| Q1 | Reduced motion in the scroll scenes | **Pins stay; scrubbing is off.** Pinned content doesn't move, so the scene sections stay pinned, but each beat is a held framing that switches by an instant cut as you scroll, and the progress rail steps per beat. (Above, the plan said pins would be off too.) |
| Q2 | Where the machine is free to drive | **Hero and Built simple** (the parked views): drag to turn, door hotspots, rotate buttons. The scroll scenes (How it works, Modular, Connected) are scroll-driven only. |
| Q3 | Doors in the free views | **One open at a time.** Stepping another door closes the previous one. |
| Q4 | Spec sheet handoff | **Dolly-zoom** from the normal 24° view to about 2°, registered to the drawing the whole way, then the orthographic camera. The dimension lines draw in as the drawing rises; leaving, the drawing's outline fades back in as the machine fades out. |
| Q5 | Phones and tablets | Coarse-pointer devices get the standard material tier (same colors and grain, no clearcoat or sheen) to keep frame times down. |
| Q6 | Intro loader | Once per browser session, at most 1.2 s, skippable by any key, click or scroll; the page behind it is inert while it runs. Reduced motion: the static mark, then a 200 ms fade. |
| Q7 | Gallery card art | One rendered module (full, and returned with its door open and stock part-used), decorative; the placard text on each card is real DOM text. |
| Q8 | Deploy hardening | CI installs with `npm ci --ignore-scripts` (no dependency needs an install script). |

---

## Assumptions
These are defaults I'll use unless you object when you review this plan.

**Copy and claims**
- **Copy IDs and DRAFT marker.** Every copy string has a stable ID and a status: `truth` (a Product truth paraphrase, listed in COPY-REVIEW with its source line for your sign-off), `draft`, or `approved`.
  - Static text lives in `index.html`, tagged `data-copy="ID"`. Each draft string gets a literal `<!-- DRAFT -->` beside it.
  - JS-only strings (aria-live, hotspot labels, placards, loader and microcopy) live in `src/content/copy.ts`. Each draft entry carries a `/* <!-- DRAFT --> */` comment, so `grep "<!-- DRAFT -->"` finds every draft string.
  - COPY-REVIEW.md lists every ID with its status and file:line.
  - `npm run check:copy` is mechanical. It fails on section text without an ID, on IDs missing from COPY-REVIEW, and, with `--final` at Phase 3 sign-off, on any remaining draft.
  - Tracing `truth` lines back to Product truth is your review step at the Phase 2 and 3 checkpoints.
  - HTML comments are stripped from the production build, so the markers never ship.
- **Price** is shown exactly as "$15,000 retail". Anything more goes to COPY-REVIEW.
- **Connectivity** is described only as access control (unlocking, with logged openings), plugged-in status, and service and restock alerts. Alert chips read only from decision 3: "Restock due (schedule)", "Fitment fault", "Lock fault". There are no phone mockups and no named recipients. No stock wording anywhere ("empty", "low", "level", "track usage").
- **Airline analogy:** the default uses Product truth's wording. A hedged alternative ("typically swapped whole") is offered in COPY-REVIEW for you to choose, because return catering exists.
- **"Built simple"** uses Product truth's wording, "durable, yet inexpensive to make and maintain". It never says "cheap". Terms like tool-free, snap-fit or recyclable go to COPY-REVIEW.
- **Sample placards** use generic names (no brands) with round illustrative quantities, labeled "Example modules". The quantities are listed in COPY-REVIEW.
- **Glossary:** machine, cabinet, slot, fitment, module, door, placard, reader. "Shelf" appears once, as an introduction ("modular shelves, called modules"). "Light pipe" and the meanings of the light states are DRAFT terms.
- **Brand rendering:** the real ³ character in text; accessible name "m³ (M-cubed)"; `m3` only in filenames and URLs; m³ is never all-capped; volumes in liters or ft³, never "m³".
- **Locale:** en-US, imperial first and metric second ("72 in · 1.83 m"), USD.
- **SEO and sharing:** `<title>` and the meta description (both in COPY-REVIEW), plus og:title, og:description, absolute og:url and og:image, twitter:card and a canonical link. These are written at build time from `SITE_URL` in `site.ts`.
- **Footer and CTA:** "© 2026 m³". The CTA reads "Get in touch". Until an email is set, the CTA shows a TBD chip and is `aria-disabled`. Once set, the address is assembled at runtime and also shown as text.
- **Playful microcopy** appears only in hints, the loader, edge states and the footer sign-off. Never in claims, specs or alt text.
- **Name caution (not legal advice):** placards stay brand-free and the page avoids red-on-white treatments (3M proximity). The wordmark is compared side by side with the Muni worm to make sure it doesn't resemble it.

**Engineering**
- **Placard text** is a high-resolution CanvasTexture atlas drawn by a browser-only `model/placardAtlas.ts` after `document.fonts.load()`. It works with the self-hosted woff2 fonts and exports into the GLB and OG image. **troika-three-text is not used**: it fetches fallback glyphs from a CDN, can't read woff2 and doesn't export.
- **`buildMachine(config)` is pure and DOM-free.** It returns the Group, a named parts registry, `outerDims`, and placard descriptors ({slot, product, packed, UV rect}). It creates no canvas, so it unit-tests in Node. The noise-normal texture is a DataTexture generated from a typed array.
- **Unit tests** (Vitest, node environment) cover:
  - the default 2×6 config giving 0.99 / 1.83 / 0.89 m ±5 mm;
  - alternate grids: 3×4, 1×8 with the 12-item module list (extras ignored), and 3×6 with 12 modules (empty slots render);
  - both stroke paths, with exactly one status segment per slot;
  - a renamed placard;
  - derived spec rows that change with the grid.
- **TypeScript** is pinned **~6.0.3**, matching the create-vite template. The config is split: `tsconfig.json` (references only), `tsconfig.app.json` (src, DOM, `vite/client`) and `tsconfig.node.json` (scripts, tests, configs; `types: ['node']`). Build is `tsc -b && vite build`, and `@types/node` is a dev dependency. Scripts run with Node 24's built-in type stripping (`node scripts/x.ts`), with no tsx.
- **Node:** `.nvmrc` = 24, `engines.node` = `>=22.19.0` (Lighthouse needs it), and CI uses `node-version-file: .nvmrc`.
- **PowerShell** blocks `npm.ps1` under the default execution policy, so docs and scripts use `npm.cmd` / `npx.cmd`. I won't change the execution policy (a security setting).
- **Browser automation:** Playwright drives the **Edge already installed on Windows** (`channel: 'msedge'`), headed, on the real GPU, so there's no browser download. The first Phase 1 step is a smoke launch. If managed-Edge policy blocks automation, the fallback is `npx playwright install chromium`, a download I'll ask about first.
- **Lighthouse:** `scripts/lighthouse.ts` launches headed Edge via Playwright with a debugging port and runs Lighthouse against `vite preview` at /M3/ (desktop preset, median of 3). After each run it checks `document.documentElement.dataset.gl === 'webgl2'` and fails if WebGL is absent, so the fallback path is never scored by mistake.
- **Renderer and pointer input:** a single WebGL2 `WebGLRenderer` with one fixed, transparent canvas behind all sections. WebGL2 is feature-detected first, software-only rendering counts as "no WebGL", and `?nowebgl` forces the fallback.
  - Pointer input (drag, hover raycast, click) is attached to a transparent hit layer in the Hero and Modular sections, never to the canvas.
  - The camera has one owner, the GSAP choreography. Drag, cursor tilt and idle drift are clamped yaw and pitch offsets on a `machineRig` group.
  - OrbitControls is used only in the Phase 1 `lab.html` blockout harness.
- **Generated assets:** `npm run render:assets` (Playwright) generates the stills, encoded in-page via `canvas.toDataURL('image/webp')` and stamped with a config hash; the build warns when they're stale. They are:
  - transparent per-scene stills (hero, unlock, exploded, swap, front);
  - the two module-gallery card images (`module-full`, `module-returned`);
  - the 1200×630 OG image;
  - the hero LCP still.
- **GLB export:** `npm run export:glb` writes `public/m3.glb` via GLTFExporter (binary, canvas placards included). It isn't linked from the page.
- **CSP:** no analytics, cookies or third-party requests. A meta CSP is injected **only in production builds** (`transformIndexHtml`, `apply: 'build'`), so `vite dev` isn't broken: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'none'`.
- **Hosting repo:** assumed github.com/carterbkeeling/M3, public (free Pages needs a public repo). A public repo also exposes PLAN.md, COPY-REVIEW.md (draft claims, plus the 3M and Muni notes) and docs/checkpoints. Before the first push, I'll ask you to confirm the owner, the visibility, and whether those files stay in the pushed branch.
- **Git:** the M3 repo already exists (cloned in this session), so no new `git init` is needed. On approval I add `.gitignore` (node_modules, dist, test-results, playwright-report, reports/, reference/) and `.gitattributes` (`* text=auto eol=lf`, with binaries marked), and commit PLAN.md. No LICENSE file (all rights reserved) unless you ask. OFL license texts ship with the fonts.

**Design**
- **Radius family:** R = 12 mm outer edges, 9 mm inner, 24 mm cabinet corners, and the stroke's turn radius = R. In the UI: pill buttons, 16 px card radius, and one stroke weight (2 px, or 3 px at ≥1440 px).
- **Section tones** strictly alternate (dark/light). A **continuous stroke divider draws itself at every section boundary** alongside the tone change, and the same stroke treatment is used inside sections and as the nav indicator. The dark machine on dark sections gets a cool rim light and a bone-tinted floor glow so it never disappears.
- **Three dark colorways at Phase 1:** **Graphite Matte** (body #2A2C31, doors one step lighter), **Carbon Satin** (near-black body, satin doors) and **Charcoal Two-Tone** (charcoal body #232428, dark warm-taupe doors #3A3632). No body or door surface is lighter than about #45464B. Only the placards and the stroke are light, and the stroke is always Pipe Cyan.
- **Door styles at Phase 1:** (1) side-hinged on the left with a molded vertical pull, and (2) bottom-hinged drop-down with a full-width recessed pull lip. The style is set in config (`door.style`). Modules are identical, so every door hinges the same way.
- **Accent-stroke paths at Phase 1:**
  - **Center spine:** header → around the reader → down each mullion (down the left side frame when there's one column), with one S-turn lobe per slot that bends into that slot's frame.
  - **Serpentine:** loops around each door.
  - Both are generated from config for any grid, so every slot has exactly one segment that touches only that slot. If the spine doesn't generalize cleanly at Phase 1, serpentine becomes the default.
- **The cursor glint** on the stroke is a specular effect only. It never changes a segment's emissive brightness, so it can't be mistaken for a status change.
- **Wordmark at Phase 1:** three candidates, each a constant-width single-stroke "m" with a same-weight superscript 3. One flows continuously from the m into the 3, so only that candidate draws as literally one stroke in the loader. The others draw the m and then the 3, which I'll flag when you pick. Each is shown next to the Muni worm.
- **Physical details:** a molded plinth with leveling feet. Doors are solid molded panels (no window). The reader is a plain tap pad with a small indicator ring (no screen).
- **Theming:** fixed art direction that ignores the system light/dark preference, with `color-scheme` set per section. `prefers-contrast: more` thickens strokes and raises caption contrast.
- **Layout:** a 12-column grid with 16–24 px gutters and text max ~1440 px wide, verified from 360 to 2560 px. The machine is sized to the viewport height so it doesn't balloon at 2560 px.

---

## Stack
Versions verified on npm on 2026-10-15.

| Package | Version | Role |
|---|---|---|
| vite | ^8.3 | dev server + static build (Rolldown), `base: '/M3/'` |
| typescript | ~6.0.3 | type-check (`tsc -b && vite build`) |
| three + @types/three | 0.186.x | renderer; addons RoundedBoxGeometry, GLTFExporter; OrbitControls (Phase 1 lab only) |
| gsap | 3.15 | ScrollTrigger, DrawSVGPlugin; `gsap.matchMedia()` for reduced motion (free for commercial use under the GSAP Standard License, not OSI) |
| lenis | 1.3.x | smooth scroll on desktop, driven by the GSAP ticker (`lenis.on('scroll', ScrollTrigger.update)`) |
| @fontsource/m-plus-rounded-1c, @fontsource-variable/jetbrains-mono | 5.3 | self-hosted OFL fonts (latin subsets) |
| @playwright/test | 1.64 (dev) | captures, e2e tests, asset rendering, GLB export (Edge channel) |
| vitest | latest (dev) | unit tests for `buildMachine` |
| lighthouse | 13.5 (dev) | scores (Node ≥ 22.19) |
| @axe-core/playwright | latest (dev) | accessibility checks on all three paths |
| @types/node | ^24 (dev) | types for scripts, tests and configs |

## File structure
```
M3/
  index.html                  semantic page; all static section copy tagged data-copy="ID" (+ <!-- DRAFT -->)
  lab.html                    dev-only blockout harness (not a build input)
  vite.config.ts              base '/M3/'; strip-HTML-comments; build-only CSP; head-meta (absolute OG/canonical from SITE_URL)
  playwright.config.ts        msedge channel; webServer = vite preview; baseURL …/M3/
  package.json  .nvmrc  .gitignore  .gitattributes
  tsconfig.json  tsconfig.app.json  tsconfig.node.json
  PLAN.md  COPY-REVIEW.md  README.md
  public/
    favicon.svg  apple-touch-icon.png  og.png  m3.glb
    stills/ hero.webp unlock.webp exploded.webp swap.webp front.webp module-full.webp module-returned.webp
  src/
    main.ts                   boot: fonts, nav, loader, Lenis+GSAP; lazy-load the 3D after first paint
    lab.ts                    bare scene + OrbitControls; ?colorway=&door=&stroke=&state=open|pulled for captures
    styles/ tokens.css base.css layout.css sections.css
    brand/ wordmark.ts        SVG path data for the m³ mark (loader, nav, hero, footer, OG)
    content/
      copy.ts                 JS-only strings with IDs + status
      specs.ts                spec rows (null → TBD chip), price row; dimension and slot rows derived from config via outerDims
      site.ts                 email (TBD); SITE_URL = 'https://carterbkeeling.github.io/M3/'
    model/
      config.ts               ★ the ONE file: dimensions, radius family, slot grid, door style, module list + placards, colorway, stroke path
      buildMachine.ts         pure, DOM-free: config → Group + parts registry + outerDims + placard descriptors
      placardAtlas.ts         browser-only: draws the placard atlas from descriptors after fonts load
      shapes.ts               rounded-rect Shapes, fillets, draft helpers
      materials.ts            molded-plastic MeshPhysicalMaterial (+ Standard tier), emissive pipe, DataTexture noise
      components/ Cabinet.ts Slot.ts Fitment.ts Module.ts Door.ts Lock.ts Placard.ts
                  StatusLight.ts Reader.ts AccentStroke.ts Contents.ts
    scene/
      renderer.ts             WebGL2 detect, pixel cap, render-on-demand, context loss
      stage.ts                RoomEnvironment + PMREM, 3 lights, baked contact shadow
      cameras.ts              framings per section; perspective → ortho handoff
      scenes/ hero.ts swap.ts exploded.ts unlock.ts front.ts
      interaction.ts          rig-offset drag/tilt on section hit layers; picking; door cycle; pan-y
    ui/ loader.ts nav.ts gallery.ts dividers.ts specSheet.ts elevation.ts tbd.ts reveal.ts
    a11y/ hotspots.ts         DOM buttons projected over doors; roving keys; rotate buttons; aria-live
  scripts/ render-assets.ts export-glb.ts lighthouse.ts check-copy.ts
  tests/
    unit/buildMachine.test.ts
    e2e/ nav, console, paths (default/reduced/nowebgl), overflow, a11y, meta, keyboard
    capture/ blockout.spec.ts reference.spec.ts checkpoint.spec.ts
  docs/checkpoints/phase-1/ phase-2/ phase-3/   committed, downscaled screenshots
  .github/workflows/deploy.yml   (Phase 3; push to main + workflow_dispatch)
  reference/                  landonorris captures (gitignored)
```

## Page outline
Section order follows the brief, with Price removed (decision 9). **Tone** is the section background: **D** = dark (graphite), **L** = light (bone). **"You"** names the audience.

| # | Section | Tone | 3D | Content and layout | "You" |
|---|---|---|---|---|---|
| 1 | **Loader** | D | – | The m³ mark draws itself as one stroke (DrawSVG), ≤ 1.2 s, over an already-painted hero. Skippable with any input, plays once per session. Reduced motion: a static mark for about 300 ms. | – |
| 2 | **Hero** | D | (a) | Oversized wordmark behind the machine, with the caption label "M-cubed · Modular Machine Management". A one-line tagline (DRAFT). The "Get in touch" CTA bottom-left (inside the first viewport on mobile). The machine at three-quarter view with idle drift, cursor tilt (≤ ±6° yaw, ±3° pitch) and a specular glint that glides along the stroke toward the cursor. | neutral |
| 3 | **The idea** | L | parked | One big split line (DRAFT, e.g. "Swap the module. / Skip the count.") plus 2–3 sentences explaining the Airplane Food Model. | vendor |
| 4 | **How it works** | D | (d) swap | Pinned, with a stroke progress rail and three beats. **Load** (at the warehouse). **Swap** (on site: a closed used module slides out, a full one slides in, and its segment lights; a quick cascade shows every slot is swapped). **Count** (back at the warehouse: the returned module alone, opened, "counted here, not on site", with RMA and invoice chips). | vendor |
| 5 | **Modular by design** | L | (c) exploded | Truth line: every slot has the same universal fitment, and any module fits any slot. A module slides out, the fitment rails and connector highlight, and the shell separates into six parts (an illustration, flagged in COPY-REVIEW). Then the **module gallery**: one card per config module. Card art is the two pre-rendered stills; the name and "Packed: N" are DOM text from `config.modules`. Hover, `:focus-visible` or tap (aria-pressed) crossfades from full to "returned to the warehouse" with the door open. Alt text names the product and its state. Free interaction is on here. | both |
| 6 | **Connected, not counting** | D | (b) unlock | A badge taps the reader, the slot's segment pulses bright, and the door swings open on its product. Three labeled functions: Access control (tap to unlock; openings logged), Plugged-in status, and Service and restock alerts (restock schedule; fitment or lock faults). Then a deliberate statement: m³ doesn't count items. | site (unlock) / vendor (alerts) |
| 7 | **Built simple** | L | parked ¾ | Injection-molded body and low-voltage power: "durable, yet inexpensive to make and maintain". Two or three big facts from Product truth and the decisions, with small mono labels. | vendor |
| 8 | **Background** | D | fades out | VMI in two sentences, the on-site counting and troubleshooting burden m³ removes, and the airline-catering inspiration (all DRAFT). | vendor |
| 9 | **Spec sheet** | L | (e) ortho | The live model eases to an orthographic front view beside the spec table, with an SVG dimension-line overlay registered from `outerDims(config)`. The same SVG elevation is used for no-WebGL and print. The spec table (JetBrains Mono) has dimensions and slots computed from config (≈, approx.; defaults print ≈ 72 × 39 × 35 in · 1.83 × 0.99 × 0.89 m and 12 slots, 2×6), access (badge or phone tap), price ($15,000 retail), and TBD chips for power, connectivity, resin, weight, module capacity and warranty. | neutral |
| 10 | **Footer** | D | – | Big CTA, contact (email TBD chip), small sign-off microcopy, "© 2026 m³". | vendor |

**Nav:** wordmark + Idea · How it works · Modular · Connected · Specs, plus a "Get in touch" pill. It's sticky, hides on scroll-down, flips color with the section tone, and has a cyan-stroke active indicator. Mobile gets a full-screen menu. Anchors land at the start of pinned scenes (Lenis `anchors: true`), plus a skip link.

## 3D component breakdown
Everything is driven by `src/model/config.ts`. Units are meters, at true scale.

```ts
// sketch of config.ts
export const config = {
  radius:   { edge: 0.012, inner: 0.009, corner: 0.024 },
  wall:     0.004,                                    // uniform wall thickness
  slot:     { w: 0.42, h: 0.243, d: 0.78 },           // opening size, fixed by the universal fitment
  grid:     { cols: 2, rows: 6 },
  cabinet:  { header: 0.17, plinth: 0.10, mullion: 0.05, side: 0.05,
              rail: 0.020, back: 0.07, front: 0.04 }, // rail = row divider; back = rear wall + ribs/connector cavity; front = door + pull
  door:     { style: 'side', hinge: 'left' },         // 'side' | 'drop'; approved at Phase 1
  colorway: 'graphiteMatte',
  stroke:   { path: 'spine', width: 0.008, turnRadius: 0.012 },
  modules:  [ { product: 'Nitrile gloves', packed: '100 pairs' }, /* … 12 */ ],
  // modules fill slots row-major; extras beyond cols×rows are ignored (dev warning);
  // unfilled slots render empty: fitment visible, segment dim
}
```

`outerDims(config)` computes the outer dimensions:
- W = cols·slot.w + (cols−1)·mullion + 2·side
- H = rows·slot.h + (rows−1)·rail + header + plinth
- D = back + slot.d + front

For 2×6 that gives **0.99 × 1.828 × 0.89 m ≈ 39 × 72 × 35 in** (checked). The spec rows, the dimension overlay, the ortho frustum and the SVG elevation all read from `outerDims`.

- **Cabinet:** a uniform-wall shell, filleted from the radius family, with a subtle parting line, molded ribs on the back, a header cap housing the Reader, and a plinth with leveling feet.
- **Slot:** a drafted opening that matches the edge radius. It hosts one Fitment.
- **Fitment:** identical rail-and-connector geometry: two rails with snap-fit tabs and a low-voltage connector block at the rear. Instanced, and clearly visible when a module is out.
- **Module:** a closed tub with molded underside ribs and rails that mate with the fitment. It carries Door, Lock and Contents.
- **Door:** style A (side-hinged left) with molded hinge knuckles and a vertical pull, or style B (drop-down). It carries the **Placard** and swings with it.
- **Lock:** a small latch on the module that moves visibly on unlock.
- **Placard:** a molded holder on the door with a printed insert (canvas atlas): the product name in the display face and "Packed: N" in mono.
- **StatusLight:** the stroke segment that belongs to each slot (its spine lobe or serpentine loop). States: no module (dim), plugged in (steady), unlocked (pulse, then a bright hold). Brightness changes rather than color alone, and captions and aria-live text state the status in words ("no module", "plugged in", "unlocked").
- **Reader:** a tap pad with an indicator ring in the header.
- **AccentStroke:** one TubeGeometry along a single continuous path generated from config, with an emissive Pipe Cyan material, split into exactly cols×rows addressable segments.
- **Contents:** generic instanced cartons and pouches in neutral tones, in full and returned-at-warehouse states.
- **Materials:** MeshPhysicalMaterial, matte, with a fine DataTexture noise normal, satin sheen and clearcoat on the edge radii, plus a Standard-material tier for weaker GPUs. One RoomEnvironment through PMREM plus three lights, and a baked or blurred contact shadow (r186 removed PCFSoftShadowMap).
- **Performance:**
  - Repeated parts (fitments, ribs, hinge knuckles, contents) are instanced.
  - Pixel ratio is capped at 2, and rendered pixels at about 3.7 MP.
  - Render on demand; paused offscreen or when the tab is hidden; ≤ 150 draw calls.
  - Geometry is built in idle-time chunks after first paint, and shaders use `compileAsync`.

## Scroll choreography
One persistent canvas. Each section declares a framing, and GSAP ScrollTrigger tweens the camera and part states between them. Scene state is keyed by section (not by scene letter), and any door the user opened resets when a scene starts.

| Section | Pin (desktop / phone) | Timeline |
|---|---|---|
| Hero (a) | none | idle drift + cursor tilt; drag to rotate on the hit layer (yaw ±35°, small pitch) |
| Idea | none | the machine parks small at the right (desktop) or top (phone); text reveals once |
| How it works (d) | ~250 vh / ~150 vh, snap per beat | Load: the camera isolates a module being filled → Swap: the used module slides out, the full one slides in, its segment lights, other slots cascade → Count: the returned module alone opens to show reduced contents, with RMA and invoice chips |
| Modular (c) | ~150 vh / ~100 vh | a module slides out and lifts clear → the machine turns nearly face-on as the fitment rails and connector highlight → it turns back as the shell parts separate → reassemble → gallery |
| Connected (b) | ~150 vh / ~100 vh | a badge approaches the reader → ring pulse → the slot's segment pulses → the door swings open → a hold with the three function labels |
| Built simple | none | rests at three-quarter view; light rakes across the edge radii |
| Background | none | the machine fades out |
| Spec (e) | ~100 vh / none | perspective dolly-zoom (FOV to about 2°) → swap to OrthographicCamera, with its frustum and the SVG viewBox both from `outerDims` → dimension overlay draws in |

On phones the canvas takes the top 55–60 svh with copy below. ScrollTrigger uses `ignoreMobileResize`. Lenis runs on desktop only, so touch stays native. 3D ScrollTriggers are only created once the scene has loaded.

## Interaction and accessibility
- **Drag and touch:** drag rotates within limits, on the section hit layer with `touch-action: pan-y`, so vertical touch always scrolls the page and horizontal drags rotate.
- **Hover and door cycle:** hovering a door highlights its placard. Click or tap plays a reader tap, then unlocks and opens the door. Click again to pull the module out and reveal the fitment, and a third click closes it. Esc resets. Free interaction is in the Hero and Modular sections (plus door hotspots in Connected).
- **Keyboard:**
  - A DOM hotspot button (≥ 44 px) is projected over each door. Arrow keys move between doors, Enter or Space advances the door cycle, and Esc resets.
  - Focusing a hotspot does the same as hovering it: the placard highlights and the product is announced.
  - Two visible rotate buttons (also Shift+←/→) turn the machine within the same yaw limits.
  - An `aria-live` region announces states. The canvas is `aria-hidden`, and each scene has a visible caption plus a text equivalent.
- **Landmarks and focus:** header, nav, main, sections with headings, and footer. Focus rings are ≥ 3:1 on both tones (cyan on dark, graphite on light).
- **Reduced motion** (via `gsap.matchMedia()`):
  - Lenis is off, the loader shows a static mark, there's no drift or parallax, and dividers are pre-drawn.
  - **Pins and scrubbing are off.** Each beat of the scene sections is a static framing with its caption. It switches by an instant cut (or a fade ≤ 200 ms) as that beat's caption scrolls into view, so your scroll drives the steps.
  - Door hotspots stay available, and user-triggered door moves take ≤ 200 ms.
- **No WebGL:** the per-scene stills plus text equivalents, with no pins. The gallery keeps its image cards (pre-rendered) and the spec sheet shows the SVG elevation.

## Phases and checkpoints
**Phase 1: setup and model blockout.**
1. Verify Node.
2. Smoke-launch Edge via Playwright.
3. Scaffold Vite + TS, add the dependencies, and configure Playwright.
4. Capture landonorris.com into `reference/`.
5. Build the untextured true-scale blockout in `lab.html`, with orbit controls: shell, slot grid, fitments, reader, and one module with door and blank placard.
6. Capture every variant with `tests/capture/blockout.spec.ts` using URL overrides on top of config.ts: front, three-quarter, side, one door open, one module pulled out, door styles A and B, the three dark colorways (on dark and light), the two stroke paths, and three wordmark candidates (with how each draws in the loader).
7. Review the captures myself and fix anything off, then show you.
8. Commit locally, then weigh the security implications of the committed code (dependencies). If anything looks risky, ask whether you want a security scan (https://code.claude.com/docs/en/claude-security).

→ **Checkpoint:** you approve proportions, door style, curve language and colorway (plus stroke path and wordmark). I write the chosen values back into config.ts.

**Phase 2: page skeleton.**
1. Build every section with real layout and draft copy, mount the model in the hero, and rough in the choreography.
2. Take screenshots at 1440 px and 390 px, and write COPY-REVIEW.md.
3. Commit locally, weigh security (CSP, runtime mailto assembly, dependencies), and ask about a scan if anything looks risky.

→ **Checkpoint:** you approve section order, layout and copy.

**Phase 3: materials, motion and polish.**
1. Materials and lighting, canvas placards, animations, the loader and micro-interactions.
2. The reduced-motion and no-WebGL paths.
3. A performance pass, with per-scene frame times measured on this laptop using `?debug` (p95 ≤ 16.7 ms) and reported. You check the scenes on your phone.
4. `render:assets` and `export:glb`, the deploy workflow, and the README.
5. Show you the final screenshots (including 2560 px, reduced motion and no-WebGL), Lighthouse scores (desktop gated, mobile reported) and the remaining TBD list.
6. Commit locally, then weigh security, including the Actions workflow's permissions and third-party actions, and ask about a scan if anything looks risky.

→ **Checkpoint:** every acceptance item passes. After your OK and your confirmation of the repo owner, its visibility and which internal docs to publish:
1. You set Settings → Pages → Source = GitHub Actions (before the first push).
2. I push.
3. I verify the live URL.

## Acceptance checks
How each one is verified:
- `npm.cmd install; npm.cmd run dev` runs, and `npm.cmd run build` passes with no type errors.
- A Playwright test against `vite preview` at /M3/ (the build with CSP) asserts zero console errors or warnings, including CSP violations, on the default, reduced-motion and `?nowebgl` paths at 360, 390, 768, 1440 and 2560 px. Known warning sources are avoided: an unused font preload, THREE.Clock, and GSAP tweens on missing targets.
- An e2e test clicks every nav link and asserts the target section is in view.
- Vitest covers the grid and placard changes (see Assumptions), plus one before/after screenshot pair.
- `check:copy --final` passes, meaning every ID is `truth` or `approved` in COPY-REVIEW. Spec rows with null values render TBD chips.
- Screenshots of the reduced-motion and no-WebGL paths are committed under `docs/checkpoints/phase-3/`.
- `npm.cmd run lh`: Lighthouse desktop median of 3, Performance ≥ 80 and Accessibility ≥ 95. It fails if WebGL is absent. axe runs clean on all three paths, and a keyboard-only walkthrough is completed.
- An e2e test asserts the title, meta description, and absolute og:image and canonical URLs on the built page.
- README covers running, editing config/placards/specs, deploying and the open TBD list.

## Risks
- **Node isn't installed yet.** Phase 1 is blocked until it is. This session's PATH may not see the new install, so I'll call Node by its full path if needed. A corporate proxy could break `npm install`, and the fix is an IT-provided CA file.
- **Managed Edge:** IT policy could block automation, in which case the fallback is a Chromium download (I ask first).
- **Performance vs hardware:** the only test GPU is integrated (Radeon 740M). MeshPhysicalMaterial at large sizes needs the pixel cap and a quality tier, and the mid-range-phone target can only be checked on your phone.
- **LCP and TBT** dominate the Performance score. They're protected by the hero still (the LCP element) and chunked 3D init.
- **Stale generated assets:** stills, the OG image and the GLB go stale after config edits. A config-hash check makes the build warn, and you rerun `render:assets`. Gallery text is DOM text, so it never goes stale.
- **Base path `/M3/`:** runtime URLs use `import.meta.env.BASE_URL`, and OG and canonical URLs are absolute. I test with `vite preview` at /M3/, not just dev. Pages paths are case-sensitive.
- **Windows lockfile in Linux CI:** generate the lockfile from a clean install and watch the first CI run.
- **Claims:** the airline analogy, "a new kind of", the light-pipe wording and the exploded-view part count all go through COPY-REVIEW. Name and mark proximity (3M, Muni) gets a visual check, not a legal search.
- **Public repo:** nothing is pushed until final approval. The internal docs would be public too, which is confirmed at the push step. The deployed site is public either way.
- **GSAP license:** free for commercial use but not open source (recorded in README).

## Open TBD list
Contact email · power input · connectivity type · resin · weight · module capacity · warranty · confirmed final dimensions · placard quantities (illustrative) · exact copy lines pending COPY-REVIEW · repo owner/visibility confirmation.
