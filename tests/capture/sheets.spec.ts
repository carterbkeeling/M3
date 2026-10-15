import { test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// Composite contact sheets of the Phase 1 captures, for checkpoint review.
// Output: docs/checkpoints/phase-1/sheet-*.jpg

const DIR = 'docs/checkpoints/phase-1'

interface Sheet {
  name: string
  title: string
  cols: number
  cells: Array<[file: string, label: string]>
}

const sheets: Sheet[] = [
  {
    name: 'sheet-a-proportions',
    title: 'Proportions · ≈ 72 × 39 × 35 in (1.83 × 0.99 × 0.89 m) · 2 × 6 slots',
    cols: 3,
    cells: [
      ['01-front.jpg', 'Front · 1.75 m figure for scale'],
      ['02-three-quarter.jpg', 'Three-quarter'],
      ['03-side.jpg', 'Side'],
      ['04-back.jpg', 'Back (molded ribs)'],
      ['05-ortho-front.jpg', 'Orthographic front'],
    ],
  },
  {
    name: 'sheet-b-door-styles',
    title: 'Door styles · A: side-hinged, molded finger pocket · B: drop-down, recessed full-width lip',
    cols: 4,
    cells: [
      ['10-door-side-detail.jpg', 'A · side-hinged, closed'],
      ['11-door-side-open-detail.jpg', 'A · open (latch on the inside face)'],
      ['06-door-open.jpg', 'A · one door open'],
      ['06b-door-open-right-column.jpg', 'A · right-column door open'],
      ['12-door-drop-detail.jpg', 'B · drop-down, closed'],
      ['13-door-drop-open-detail.jpg', 'B · open'],
      ['14-door-drop-front.jpg', 'B · front'],
    ],
  },
  {
    name: 'sheet-c-module-fitment',
    title: 'Module and universal fitment',
    cols: 2,
    cells: [
      ['07-module-pulled.jpg', 'Module pulled out (door travels with it)'],
      ['08-module-pulled-detail.jpg', 'Pulled, detail'],
      ['09-one-module-fitments.jpg', 'One module in; empty slots show their fitments'],
      ['09b-module-removed-fitment-detail.jpg', 'Module removed: rails, snap tabs, rear connector'],
    ],
  },
  {
    name: 'sheet-d-colorways',
    title: 'Colorways (dark machine only) · on graphite and bone backgrounds',
    cols: 3,
    cells: [
      ['20-colorway-graphite-matte-dark.jpg', 'Graphite Matte'],
      ['22-colorway-carbon-satin-dark.jpg', 'Carbon Satin'],
      ['24-colorway-charcoal-two-tone-dark.jpg', 'Charcoal Two-Tone'],
      ['21-colorway-graphite-matte-light.jpg', 'Graphite Matte'],
      ['23-colorway-carbon-satin-light.jpg', 'Carbon Satin'],
      ['25-colorway-charcoal-two-tone-light.jpg', 'Charcoal Two-Tone'],
    ],
  },
  {
    name: 'sheet-e-stroke-paths',
    title: 'Accent stroke (light pipe) · each slot owns one stretch = its status light',
    cols: 2,
    cells: [
      ['15-stroke-spine-front.jpg', 'Spine (recommended) · one S per row, upper lobe = left door, lower = right'],
      ['16-stroke-serpentine-front.jpg', 'Rail serpentine · each slot owns the run above it (runs sit between rows)'],
      ['17-stroke-spine-reader-detail.jpg', 'Spine · reader mid-spine (~35 in), stroke flows into its ring and out'],
      ['18-stroke-serpentine-header-detail.jpg', 'Serpentine · reader loop'],
      ['19-light-states-front.jpg', 'Light states · 2 slots empty (dim), 1 unlocked (bright), rest plugged in'],
      ['19b-light-states-detail.jpg', 'Light states · detail'],
    ],
  },
  {
    name: 'sheet-f-config-driven',
    title: 'Config-driven · same code, grid changed in config.ts only',
    cols: 3,
    cells: [
      ['30-grid-3x4.jpg', '3 × 4, spine'],
      ['32-grid-3x4-serpentine.jpg', '3 × 4, serpentine'],
      ['31-grid-1x8.jpg', '1 × 8, spine'],
    ],
  },
]

const img = (file: string) => {
  const p = `${DIR}/${file}`
  return existsSync(p) ? `data:image/jpeg;base64,${readFileSync(p).toString('base64')}` : ''
}

for (const sheet of sheets) {
  test(sheet.name, async ({ page }) => {
    const width = 2400
    await page.setViewportSize({ width, height: 1200 })
    const cells = sheet.cells
      .map(([f, label]) => `<figure><img src="${img(f)}" alt=""><figcaption>${label}</figcaption></figure>`)
      .join('')
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 40px; background: #15161A; color: #F3EFE7; font: 500 22px/1.3 system-ui, sans-serif; width: ${width - 80}px; }
      h1 { margin: 0 0 28px; font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
      h1 span { color: #12D6FF; }
      .grid { display: grid; grid-template-columns: repeat(${sheet.cols}, 1fr); gap: 20px; }
      figure { margin: 0; }
      img { width: 100%; display: block; border-radius: 12px; }
      figcaption { margin-top: 10px; color: #7F8187; font: 500 18px/1.3 ui-monospace, Consolas, monospace; }
    </style><h1><span>m³</span> Phase 1 blockout · ${sheet.title}</h1><div class="grid">${cells}</div>`)
    await page.waitForLoadState('load')
    await page.screenshot({ path: `${DIR}/${sheet.name}.jpg`, fullPage: true, type: 'jpeg', quality: 85 })
  })
}
