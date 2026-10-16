import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Phase 3 materials, lighting and placard captures from the lab (lab.html), which uses the
// production materials (createMaterials tiers), scene/lighting.ts and the placard atlas.
// Output: docs/checkpoints/phase-3/materials-*.jpg

declare global {
  interface Window {
    __labReady?: boolean
  }
}

const OUT = 'docs/checkpoints/phase-3'
mkdirSync(OUT, { recursive: true })

interface Shot {
  name: string
  query: string
  size?: { width: number; height: number }
}

const hero = { width: 1440, height: 900 }
const wide = { width: 1600, height: 1000 }

const shots: Shot[] = [
  // Hero-like framing (machine ~700 px tall at 1440×900): plastic and placards at page scale.
  { name: 'materials-01-threequarter-dark', query: 'view=hero&bg=dark', size: hero },
  { name: 'materials-02-threequarter-light', query: 'view=hero&bg=light', size: hero },
  // Close door view (~1.25 m) and the nearest placard view (~0.6 m): text must be sharp.
  { name: 'materials-03-door-detail', query: 'view=detail&slot=4&bg=dark', size: wide },
  { name: 'materials-04-placard-closeup', query: 'view=placard&slot=1&bg=dark', size: wide },
  // A module pulled out on its rails: fitment, tub and door edges.
  { name: 'materials-05-module-pulled-detail', query: 'view=detail&state=pulled&slot=4&bg=dark', size: wide },
  // Colorway comparison on dark.
  { name: 'materials-06-carbon-satin-dark', query: 'view=hero&colorway=carbonSatin&bg=dark', size: hero },
  { name: 'materials-07-charcoal-two-tone-dark', query: 'view=hero&colorway=charcoalTwoTone&bg=dark', size: hero },
  // Weaker-GPU tier, same framing as 01.
  { name: 'materials-08-standard-tier-dark', query: 'view=hero&bg=dark&tier=standard', size: hero },
  // Shrink-to-fit: a long product name on the focus slot, and a machine with empty slots.
  { name: 'materials-09-long-name-placard', query: 'view=placard&slot=4&bg=light&name=Disposable%20polypropylene%20coveralls&packed=25%20each', size: wide },
  { name: 'materials-10-empty-slots-light', query: 'view=front&bg=light&modules=some', size: { width: 1100, height: 1400 } },
]

for (const shot of shots) {
  test(shot.name, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()} @ ${m.location().url}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.setViewportSize(shot.size ?? hero)
    await page.goto(`lab.html?clean=1&${shot.query}`)
    await page.waitForFunction(() => window.__labReady === true, null, { timeout: 60_000 })
    await page.screenshot({ path: `${OUT}/${shot.name}.jpg`, type: 'jpeg', quality: 88 })
    // Real fonts on the placards (not a fallback face).
    const fontsOk = await page.evaluate(
      () => document.fonts.check('900 40px "M PLUS Rounded 1c"') && document.fonts.check('500 40px "JetBrains Mono Variable"'),
    )
    expect(fontsOk).toBe(true)
    // The lab page has no favicon; the browser's automatic /favicon.ico request 404s on the dev server.
    const relevant = errors.filter((e) => !/GPU stall|X4122|favicon.ico/i.test(e))
    if (relevant.length) console.log(`[${shot.name}] console:\n  ${relevant.join('\n  ')}`)
    expect(relevant.filter((e) => e.startsWith('pageerror') || e.startsWith('error'))).toEqual([])
  })
}
