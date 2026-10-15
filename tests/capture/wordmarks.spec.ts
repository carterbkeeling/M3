import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Phase 1: capture the m³ wordmark specimen (dev-only wordmarks.html) and check the report the page
// computes: exact radii and no kinks, tight viewBox, whole-pixel width at 16 px, the ³'s height and
// gap, and the loader (pen lifts match singleStroke, its end state equals the resting mark).
const OUT = fileURLToPath(new URL('../../docs/checkpoints/phase-1/', import.meta.url))

interface Report {
  id: string
  singleStroke: boolean
  kinks: number
  errors: string[]
  viewBoxMatches: boolean
  sup: { top: number; bottom: number; ratio: number } | null
  widthAt16: number
  gap: number
  loader: {
    total: number
    lifts: { x: number; y: number }[]
    steps: { label: string; mode: string; start: number; end: number }[]
    restDiff: number
    withinViewBox: boolean
  }
}

const STROKE = 10

test('wordmark candidates specimen', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

  await page.goto('wordmarks.html')
  await page.waitForSelector('html[data-ready]')
  expect(await page.getAttribute('html', 'data-ready')).toBe('1')

  const report = await page.evaluate(() => (window as unknown as { __wordmarkReport: Report[] }).__wordmarkReport)
  expect(report).toHaveLength(3)
  for (const r of report) {
    const steps = r.loader.steps.map((s) => `${s.label}${s.mode === 'retract' ? '(r)' : ''} ${s.start.toFixed(0)}–${s.end.toFixed(0)}`).join(', ')
    console.log(
      `[wordmark] ${r.id}: kinks=${r.kinks} viewBox=${r.viewBoxMatches ? 'tight' : 'MISMATCH'} sup=${r.sup ? `${(r.sup.ratio * 100).toFixed(1)}%` : 'n/a'} ` +
        `16px=${r.widthAt16}px gap=${r.gap.toFixed(2)} lifts=${r.loader.lifts.length} restDiff=${r.loader.restDiff} loader=[${steps}] total=${r.loader.total.toFixed(1)}` +
        `${r.errors.length ? ` errors=${r.errors.join(' | ')}` : ''}`,
    )
    expect.soft(r.errors, `${r.id} geometry errors`).toEqual([])
    expect.soft(r.kinks, `${r.id} kinks`).toBe(0)
    expect.soft(r.viewBoxMatches, `${r.id} viewBox is tight`).toBe(true)
    // At 16 px the mark is a whole number of pixels wide (viewBox width a multiple of 5).
    expect.soft(Number.isInteger(r.widthAt16), `${r.id} whole-pixel width at 16 px (${r.widthAt16})`).toBe(true)
    // Counters and gaps never tighter than the stroke (2 px at 16 px).
    expect.soft(r.gap, `${r.id} m-to-³ gap`).toBeGreaterThanOrEqual(STROKE - 1e-6)
    // Brief: the ³ is roughly 55–62 % of the m's height (the 80-unit grid gives 62.5 %), hung from the top line.
    expect.soft(r.sup, `${r.id} superscript found`).not.toBeNull()
    if (r.sup) {
      expect.soft(r.sup.top, `${r.id} superscript top aligned with the m`).toBe(0)
      expect.soft(r.sup.ratio, `${r.id} superscript height ratio`).toBeGreaterThanOrEqual(0.55)
      expect.soft(r.sup.ratio, `${r.id} superscript height ratio`).toBeLessThanOrEqual(0.63)
    }
    // Loader: singleStroke ⇔ no pen lift; the loader ends exactly on the resting mark.
    expect.soft(r.loader.lifts.length === 0, `${r.id} singleStroke matches the loader's pen lifts`).toBe(r.singleStroke)
    expect.soft(r.loader.restDiff, `${r.id} loader end state = resting mark`).toBe(0)
    expect.soft(r.loader.withinViewBox, `${r.id} loader stays inside the viewBox`).toBe(true)
  }
  // Exactly one candidate draws as one unbroken stroke (PLAN: "only that candidate draws as literally one stroke").
  expect.soft(report.filter((r) => r.singleStroke).map((r) => r.id)).toEqual(['worm-flow'])

  await page.screenshot({ path: `${OUT}wordmarks.png`, fullPage: true })
  const ids = await page.locator('[data-candidate]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.candidate ?? ''))
  expect(ids).toHaveLength(3)
  for (const id of ids) {
    await page.locator(`[data-candidate="${id}"]`).screenshot({ path: `${OUT}wordmark-${id}.png` })
  }

  expect(problems).toEqual([])
})

// Local-only resemblance check against a schematic of the Muni worm. Written to reference/
// (gitignored) so no third-party mark, or imitation of one, lands in committed files.
test('wordmark Muni comparison (local only)', async ({ page }) => {
  await page.goto('wordmarks.html?muni=1')
  await page.waitForSelector('html[data-ready]')
  await page.screenshot({ path: fileURLToPath(new URL('../../reference/wordmarks-muni-compare.png', import.meta.url)), fullPage: true })
})
