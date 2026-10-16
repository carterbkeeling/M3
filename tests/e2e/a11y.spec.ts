import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// axe (WCAG 2.2 A/AA rules plus best practices) on the production build, on all three paths, at
// desktop and phone widths. The page is scrolled through first so every scroll reveal has run, then
// scanned from the top.

const PREVIEW = 'http://localhost:4173/M3/'

async function settle(page: Page) {
  await page.waitForFunction(() => !!document.documentElement.dataset.gl, null, { timeout: 30_000 })
  await page.waitForFunction(() => !document.querySelector('.m3-loader'), null, { timeout: 10_000 })
  const { total, vh } = await page.evaluate(() => ({ total: document.documentElement.scrollHeight, vh: innerHeight }))
  for (let y = 0; y < total; y += vh * 0.8) {
    await page.evaluate((yy) => scrollTo({ top: yy, behavior: 'instant' as ScrollBehavior }), y)
    await page.waitForTimeout(250)
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
  await page.waitForTimeout(800)
}

for (const path of ['default', 'reduced', 'nowebgl'] as const) {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`axe · ${path} · ${size.width}`, async ({ page }) => {
      test.setTimeout(90_000)
      if (path === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize(size)
      await page.goto(PREVIEW + (path === 'nowebgl' ? '?nowebgl' : ''))
      await settle(page)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze()
      const violations = results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1] ?? ''}`).join('\n    ')}`,
      )
      expect(violations, violations.join('\n')).toEqual([])
    })
  }
}
