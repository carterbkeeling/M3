# Phase 3 checkpoint (2026-10-16)

Materials, motion and polish. Measured on this laptop: Windows 11, Edge 155, AMD Radeon 740M integrated GPU.

## Results

| Check | Result |
|---|---|
| `npm run build` (tsc -b + Vite) | Passes, no type errors |
| Unit tests (Vitest) | 44 passed |
| Browser tests (Playwright, production build with CSP) | 54 passed. Clean console on the default, reduced-motion and no-WebGL paths at 360, 390, 768, 1440 and 2560 px. Nav links land on their sections. axe (WCAG 2.2 A/AA + best practices) is clean on all three paths at 1440 and 390. The keyboard walkthrough, skip link, hotspot door cycle and phone menu pass. Share and SEO tags are present. |
| Config change | `config-change.spec.ts` sets the grid to 3 × 4 and renames the first placard in `config.ts`. The model, the dimensions (≈ 51 × 58 × 35 in), the slots row and the gallery all follow with no other edits. See `config-before-*` and `config-after-*`. |
| Lighthouse, desktop (median of 3) | **Performance 95, Accessibility 100, Best Practices 100, SEO 100.** LCP 0.44 s, TBT 186 ms, CLS 0. The cold first run scored 75 (shader compilation). |
| Lighthouse, mobile (reported, not gated) | Performance 86, Accessibility 100, Best Practices 100, SEO 100 |
| Frame times (`?debug`, on mains power) | 60 fps in every section at 1440, 2560 and 390 px. CPU work per frame p95 is 3.2–4.6 ms, and dropped frames are 0–1 of 120. The frame-interval p95 is 17.4–18.0 ms, which is vsync jitter: a blank page measures 17.2 ms. On battery the browser caps every page at about 43 fps, and the page keeps up with that cap with no drops. |
| Assets | No-WebGL stills, gallery card art and the OG image are rendered from the model (`npm run render:assets`). `public/m3.glb` is 5.0 MB (`npm run export:glb`). |

## Screenshots

- `sheet-page-desktop.jpg`, `sheet-page-mobile.jpg`: every section at 1440 and 390 px (`page-*.jpg`).
- `sheet-paths-wide.jpg` (2560 px), `sheet-paths-desktop.jpg` and `sheet-paths-mobile.jpg`: the default, reduced-motion and no-WebGL paths (`path-*.jpg`).
- `sheet-interaction-config.jpg`: hero interaction (hover, open, pull, keyboard focus, drag) and the config before/after pair.
- `sheet-materials.jpg`: material and placard close-ups, the alternative colorways and the standard material tier.

## Independent review

Three reviewers covered code, accessibility and visuals and claims. A skeptic confirmed 27 of their 28 findings. All 27 are fixed, and each fix group was re-checked by a second skeptic. Highlights:

- The no-WebGL layout is decided before the first measure, and the page falls back to stills if the 3D stage fails to start.
- Double-click and key-repeat are safe in the door cycle, and only one door is open at a time.
- The machine turns to present an open door, so it never covers the wordmark.
- Hotspots frame the whole door. Focus no longer double-announces. The page behind the loader is inert.
- The Count beat now visibly shows a part-used module. The Modular scene sets the module aside so the lit fitment is visible.
- A badge taps the reader in the Connected scene.
- The divider is no longer clipped. Feet are added to the elevation. The drawing's outline crossfades back in as the machine leaves the spec sheet.
- `prefers-contrast: more` is supported, and `og:image:alt` is emitted.

## For your approval

- **Phase 3 decisions Q1–Q8** in `PLAN.md`.
- **17 draft strings** in `COPY-REVIEW.md` (all in `src/content/copy.ts`: light-state words, hotspot labels and actions, live announcements, the controls hint, the no-WebGL alt text and the OG alt text). `npm run check:copy` (run by the deploy workflow) fails until they are approved.

## Open TBD list

See the README's "Open TBD list": contact email, power input, connectivity type, resin, weight, module capacity, warranty, confirmed final dimensions, and the repo owner and visibility before the first push.
