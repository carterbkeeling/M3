import { test, expect, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

// Acceptance: a config.ts change (grid and placard) updates the model, the spec table and the gallery
// with no other edits. Edits src/model/config.ts on disk (grid 2×6 → 3×4, first placard renamed),
// lets the dev server reload, captures the same views before and after, and always restores the file.
// Output: docs/checkpoints/phase-3/config-{before|after}-{hero|specs}.jpg

const OUT = 'docs/checkpoints/phase-3'
const CONFIG = 'src/model/config.ts'

async function capture(page: Page, label: string) {
  await page.waitForFunction(() => document.documentElement.dataset.stageReady === 'true', null, { timeout: 30_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/config-${label}-hero.jpg`, type: 'jpeg', quality: 84 })
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('#specs')!
    ;(window as unknown as { __m3: { scrollTo: (y: number) => void } }).__m3.scrollTo(el.getBoundingClientRect().top + scrollY)
  })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/config-${label}-specs.jpg`, type: 'jpeg', quality: 84 })
  return page.evaluate(() => ({
    dims: document.querySelector('[data-spec="dimensions"] td')?.textContent?.trim() ?? '',
    slots: document.querySelector('[data-spec="slots"] td')?.textContent?.trim() ?? '',
    cards: document.querySelectorAll('.cards > li').length,
    first: document.querySelector('.card__name')?.textContent ?? '',
  }))
}

test('config.ts change: grid 3×4 and a renamed placard', async ({ page }) => {
  test.setTimeout(120_000)
  const original = readFileSync(CONFIG, 'utf8')
  const changed = original
    .replace('grid: { cols: 2, rows: 6 },', 'grid: { cols: 3, rows: 4 },')
    .replace("{ product: 'Nitrile gloves', packed: '100 pairs' }", "{ product: 'Nitrile gloves, size L', packed: '50 pairs' }")
  expect(changed).not.toBe(original)
  expect(changed.match(/cols: 3, rows: 4/)).toBeTruthy()
  try {
    await page.goto('./?static')
    const before = await capture(page, 'before')
    writeFileSync(CONFIG, changed)
    // The model reloads through Vite; the spec table and gallery are expanded into index.html by the
    // Vite config, so the dev server restarts to pick them up. Reload until the new grid shows.
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000)
      await page.goto('./?static').catch(() => {})
      const slots = await page.locator('[data-spec="slots"] td').textContent().catch(() => '')
      if (slots?.includes('3 × 4')) break
    }
    const after = await capture(page, 'after')
    console.log('before', before, '\nafter ', after)
    expect(before.slots).toMatch(/^12 \(2 × 6\)/)
    expect(after.slots).toMatch(/^12 \(3 × 4\)/)
    expect(after.dims).not.toBe(before.dims)
    expect(after.first).toBe('Nitrile gloves, size L')
    expect(after.cards).toBe(12)
  } finally {
    writeFileSync(CONFIG, original)
  }
})
