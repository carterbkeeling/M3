import { test, expect, type Page } from '@playwright/test'

// Keyboard-only walkthrough on the production build. Tab through the whole page: every stop must be a
// visible, on-screen control with a visible focus ring, and the skip link comes first. Then the skip
// link lands in main, the hero hotspots step the door cycle with Enter, and the phone menu opens,
// closes on Escape and hands focus back to its button.

const PREVIEW = 'http://localhost:4173/M3/'

interface Stop {
  label: string
  visible: boolean
  onScreen: boolean
  ring: boolean
}

async function stop(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return { label: '(body)', visible: false, onScreen: false, ring: false }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
    const label = `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${name}"`
    const visible =
      r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && !el.closest('[inert],[hidden],[aria-hidden="true"]')
    const onScreen = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== 'none' && cs.boxShadow !== '')
    return { label, visible, onScreen, ring }
  })
}

async function ready(page: Page) {
  await page.waitForFunction(() => !!document.documentElement.dataset.gl, null, { timeout: 30_000 })
  await page.waitForFunction(() => !document.querySelector('.m3-loader'), null, { timeout: 10_000 })
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`tab through the page · ${size.width}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(size)
    await page.goto(PREVIEW)
    await ready(page)
    const stops: Stop[] = []
    const bad: string[] = []
    for (let i = 0; i < 150; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(220)
      const s = await stop(page)
      if (s.label === '(body)' || (stops.length && s.label === stops[0].label)) break
      stops.push(s)
      if (!s.visible || !s.onScreen || !s.ring) bad.push(`${s.label}: visible=${s.visible} onScreen=${s.onScreen} ring=${s.ring}`)
    }
    console.log(`[${size.width}] ${stops.length} tab stops:\n  ${stops.map((s) => s.label).join('\n  ')}`)
    expect(stops[0]?.label).toMatch(/skip/i)
    expect(stops.length).toBeGreaterThan(10)
    expect(bad, bad.join('\n')).toEqual([])
  })
}

test('skip link lands in main', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(PREVIEW)
  await ready(page)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => location.hash)).toBe('#main')
})

test('hero hotspots step the door cycle from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(PREVIEW)
  await ready(page)
  await page.waitForFunction(() => document.documentElement.dataset.stageReady === 'true')
  const hotspot = page.locator('.hotspot').first()
  await hotspot.focus()
  const before = await hotspot.getAttribute('aria-label')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  expect(await hotspot.getAttribute('aria-label')).not.toBe(before)
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: /unlocked/i })).toHaveCount(1)
})

test('phone menu: opens, closes on Escape, focus returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(PREVIEW)
  await ready(page)
  const toggle = page.locator('.nav__toggle')
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('#menu'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => document.activeElement?.classList.contains('nav__toggle'))).toBe(true)
})
