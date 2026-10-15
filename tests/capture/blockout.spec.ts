import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Phase 1 variant captures of the blockout (lab.html), driven by URL overrides on top of config.ts.
// Output: docs/checkpoints/phase-1/*.jpg

declare global {
  interface Window {
    __labReady?: boolean
  }
}

const OUT = 'docs/checkpoints/phase-1'
mkdirSync(OUT, { recursive: true })

interface Shot {
  name: string
  query: string
  size?: { width: number; height: number }
}

const portrait = { width: 1100, height: 1400 }
const wide = { width: 1600, height: 1000 }

const shots: Shot[] = [
  // Proportions (with a lab-only 1.75 m figure for scale)
  { name: '01-front', query: 'view=front&scale=1', size: { width: 1400, height: 1400 } },
  { name: '02-three-quarter', query: 'view=threequarter&scale=1', size: { width: 1400, height: 1400 } },
  { name: '03-side', query: 'view=side&scale=1', size: { width: 1400, height: 1400 } },
  { name: '04-back', query: 'view=back' },
  { name: '05-ortho-front', query: 'view=ortho&scale=1', size: { width: 1400, height: 1400 } },
  // Door open, module pulled (brief: one door open, one module pulled out)
  { name: '06-door-open', query: 'view=threequarterleft&state=open&slot=4' },
  { name: '06b-door-open-right-column', query: 'view=threequarter&state=open&slot=5' },
  { name: '07-module-pulled', query: 'view=threequarterleft&state=pulled&slot=4' },
  { name: '08-module-pulled-detail', query: 'view=detail&state=pulled&slot=4', size: wide },
  { name: '09-one-module-fitments', query: 'view=threequarter&modules=one&slot=4' },
  { name: '09b-module-removed-fitment-detail', query: 'view=detail&state=removed&slot=4', size: wide },
  // Door styles
  { name: '10-door-side-detail', query: 'view=detail&door=side&slot=4', size: wide },
  { name: '11-door-side-open-detail', query: 'view=detail&door=side&state=open&slot=4', size: wide },
  { name: '12-door-drop-detail', query: 'view=detail&door=drop&slot=4', size: wide },
  { name: '13-door-drop-open-detail', query: 'view=detail&door=drop&state=open&slot=4', size: wide },
  { name: '14-door-drop-front', query: 'view=front&door=drop' },
  // Stroke paths and light states
  { name: '15-stroke-spine-front', query: 'view=front&stroke=spine' },
  { name: '16-stroke-serpentine-front', query: 'view=front&stroke=serpentine' },
  { name: '17-stroke-spine-reader-detail', query: 'view=reader&stroke=spine', size: wide },
  { name: '18-stroke-serpentine-header-detail', query: 'view=detail&stroke=serpentine&slot=0', size: wide },
  { name: '19-light-states-front', query: 'view=front&lights=demo' },
  { name: '19b-light-states-detail', query: 'view=detail&lights=demo&slot=6', size: wide },
  // Colorways, on dark and light
  { name: '20-colorway-graphite-matte-dark', query: 'colorway=graphiteMatte&bg=dark' },
  { name: '21-colorway-graphite-matte-light', query: 'colorway=graphiteMatte&bg=light' },
  { name: '22-colorway-carbon-satin-dark', query: 'colorway=carbonSatin&bg=dark' },
  { name: '23-colorway-carbon-satin-light', query: 'colorway=carbonSatin&bg=light' },
  { name: '24-colorway-charcoal-two-tone-dark', query: 'colorway=charcoalTwoTone&bg=dark' },
  { name: '25-colorway-charcoal-two-tone-light', query: 'colorway=charcoalTwoTone&bg=light' },
  // Config-driven: other grids with no code changes
  { name: '30-grid-3x4', query: 'view=front&grid=3x4' },
  { name: '31-grid-1x8', query: 'view=front&grid=1x8' },
  { name: '32-grid-3x4-serpentine', query: 'view=front&grid=3x4&stroke=serpentine' },
]

for (const shot of shots) {
  test(shot.name, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.setViewportSize(shot.size ?? portrait)
    await page.goto(`lab.html?clean=1&${shot.query}`)
    await page.waitForFunction(() => window.__labReady === true, null, { timeout: 60_000 })
    await page.screenshot({ path: `${OUT}/${shot.name}.jpg`, type: 'jpeg', quality: 86 })
    if (errors.length) console.log(`[${shot.name}] console:\n  ${errors.join('\n  ')}`)
  })
}
