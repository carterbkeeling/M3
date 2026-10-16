import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Acceptance: the reduced-motion and no-WebGL paths, verified with screenshots (production build).
// Output: docs/checkpoints/phase-3/path-{default|reduced|nowebgl}-{wide|desktop|mobile}-NN-*.jpg

const PREVIEW = 'http://localhost:4173/M3/'
const OUT = 'docs/checkpoints/phase-3'
mkdirSync(OUT, { recursive: true })

const shots: Array<[string, string, number?]> = [
  ['01-hero', '#top'],
  ['02-how', '#how', 0.5],
  ['03-modular', '[data-scene="exploded"]', 0.6],
  ['04-connected', '#connected', 0.62],
  ['05-specs', '#specs'],
]

async function goTo(page: Page, sel: string, p?: number) {
  await page.evaluate(
    ([s, prog]) => {
      const el = document.querySelector<HTMLElement>(s as string)!
      const top = el.getBoundingClientRect().top + window.scrollY
      const y = prog === null ? top : top + (prog as number) * Math.max(0, el.offsetHeight - window.innerHeight)
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
    },
    [sel, p ?? null] as const,
  )
  // long enough for the scroll reveals to finish, so the shots show settled text
  await page.waitForTimeout(1400)
}

for (const path of ['default', 'reduced', 'nowebgl'] as const) {
  for (const vp of [
    { label: 'wide', size: { width: 2560, height: 1440 } },
    { label: 'desktop', size: { width: 1440, height: 900 } },
    { label: 'mobile', size: { width: 390, height: 844 } },
  ]) {
    test(`${path} · ${vp.label}`, async ({ page }) => {
      test.setTimeout(90_000)
      const problems: string[] = []
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text())
      })
      page.on('pageerror', (e) => problems.push(e.message))
      if (path === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize(vp.size)
      await page.goto(PREVIEW + (path === 'nowebgl' ? '?nowebgl' : ''))
      await page.waitForLoadState('load')
      await page.waitForFunction(() => !!document.documentElement.dataset.gl, null, { timeout: 30_000 })
      // let a loader (if any) finish
      await page.waitForFunction(() => !document.querySelector('.m3-loader'), null, { timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(500)
      for (const [name, sel, p] of shots) {
        await goTo(page, sel, p)
        await page.screenshot({ path: `${OUT}/path-${path}-${vp.label}-${name}.jpg`, type: 'jpeg', quality: 82 })
      }
      if (path === 'nowebgl') {
        expect(await page.evaluate(() => document.documentElement.dataset.gl)).toBe('none')
        expect(await page.locator('img.still').count()).toBeGreaterThan(0)
      }
      expect(problems).toEqual([])
    })
  }
}
