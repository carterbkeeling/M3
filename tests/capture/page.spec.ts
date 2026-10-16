import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Screenshots of every section at 1440 px and 390 px wide, scroll scenes at several points.
// Output: docs/checkpoints/phase-3/page-{desktop|mobile}-NN-name.jpg (phase 2's set is kept as committed).

const OUT = 'docs/checkpoints/phase-3'
mkdirSync(OUT, { recursive: true })

interface Shot {
  name: string
  selector: string
  p?: number // progress through a tall section (0–1); omitted = section top
  offset?: number // extra px after the section top
  center?: boolean // center the element in the viewport instead
}

const shots: Shot[] = [
  { name: '01-hero', selector: '#top' },
  { name: '02-idea', selector: '#idea' },
  { name: '03-how-load', selector: '#how', p: 0.16 },
  { name: '04-how-swap', selector: '#how', p: 0.44 },
  { name: '05-how-count', selector: '#how', p: 0.84 },
  { name: '06-modular-out', selector: '[data-scene="exploded"]', p: 0.36 },
  { name: '07-modular-apart', selector: '[data-scene="exploded"]', p: 0.68 },
  { name: '08-gallery', selector: '.gallery' },
  { name: '09-connected-tap', selector: '#connected', p: 0.22 },
  { name: '10-connected-open', selector: '#connected', p: 0.62 },
  { name: '11-built', selector: '#built' },
  { name: '12-background', selector: '#background' },
  { name: '13-specs', selector: '#specs' },
  { name: '13b-specs-price', selector: 'tr[data-spec="price"]', center: true },
  { name: '14-footer', selector: '#contact' },
]

const viewports = [
  { label: 'desktop', size: { width: 1440, height: 900 } },
  { label: 'mobile', size: { width: 390, height: 844 } },
]

async function scrollToShot(page: Page, shot: Shot) {
  await page.evaluate(({ selector, p, offset, center }) => {
    const el = document.querySelector<HTMLElement>(selector)!
    const r = el.getBoundingClientRect()
    const top = r.top + window.scrollY
    const vh = window.innerHeight
    const y = center ? top + r.height / 2 - vh / 2 : p === undefined ? top + (offset ?? 0) : top + p * (el.offsetHeight - vh)
    ;(window as unknown as { __m3: { scrollTo: (y: number) => void } }).__m3.scrollTo(Math.max(0, y))
  }, shot)
  // let the stage and chrome settle for a few frames
  await page.waitForTimeout(450)
}

for (const vp of viewports) {
  test(`page sections · ${vp.label}`, async ({ page }) => {
    const problems: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
    })
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
    await page.setViewportSize(vp.size)
    await page.goto('./?static')
    await page.waitForFunction(() => document.documentElement.dataset.stageReady === 'true', null, { timeout: 30_000 })
    for (const shot of shots) {
      await scrollToShot(page, shot)
      await page.screenshot({ path: `${OUT}/page-${vp.label}-${shot.name}.jpg`, type: 'jpeg', quality: 84 })
    }
    if (problems.length) console.log(`[${vp.label}] console:\n  ${problems.join('\n  ')}`)
    expect(problems.filter((p) => !/X4122|Program Info Log/.test(p))).toEqual([])
  })
}
