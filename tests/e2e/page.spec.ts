import { test, expect, type Page } from '@playwright/test'

// Production build (vite preview, CSP on): console stays clean while scrolling the whole page,
// every nav link lands on its section, and the share/SEO tags are present and absolute.

const PREVIEW = 'http://localhost:4173/M3/'

// Every path (default, reduced motion, no WebGL) at every acceptance width.
const sizes = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
]
const variants = (['default', 'reduced', 'nowebgl'] as const).flatMap((path) =>
  sizes.map((size) => ({
    label: `${path} · ${size.width}`,
    size,
    query: path === 'nowebgl' ? '?nowebgl' : '',
    reduced: path === 'reduced',
  })),
)

function collect(page: Page) {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  return problems
}

for (const v of variants) {
  test(`clean console while scrolling · ${v.label}`, async ({ page }) => {
    const problems = collect(page)
    if (v.reduced) await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize(v.size)
    await page.goto(PREVIEW + v.query)
    await page.waitForLoadState('load')
    await page.waitForTimeout(1500)
    const total = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < total; y += v.size.height * 0.7) {
      await page.mouse.wheel(0, v.size.height * 0.7)
      await page.waitForTimeout(120)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'no horizontal overflow').toBeLessThanOrEqual(0)
    expect(problems).toEqual([])
  })
}

test('nav links land on their sections', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(PREVIEW)
  for (const id of ['idea', 'how', 'modular', 'connected', 'specs']) {
    await page.locator(`.nav__links a[href="#${id}"]`).click()
    await page.waitForTimeout(1600)
    const top = await page.evaluate((i) => document.getElementById(i)!.getBoundingClientRect().top, id)
    expect(Math.abs(top), `#${id} top after nav click`).toBeLessThan(40)
  }
})

test('mobile hero: the CTA is inside the first screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(PREVIEW)
  const bottom = await page.evaluate(() => document.querySelector('.hero__cta a')!.getBoundingClientRect().bottom)
  expect(bottom).toBeLessThanOrEqual(844)
})

test('the brand is never all-capped', async ({ page }) => {
  await page.goto(PREVIEW)
  const capped = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.childNodes.length && Array.from(el.childNodes).some((n) => n.nodeType === 3 && /m³/.test(n.textContent ?? '')))
      .filter((el) => getComputedStyle(el).textTransform === 'uppercase')
      .map((el) => el.outerHTML.slice(0, 80)),
  )
  expect(capped).toEqual([])
})

test('share and SEO tags', async ({ page }) => {
  await page.goto(PREVIEW)
  await expect(page).toHaveTitle(/m³/)
  expect(await page.getAttribute('meta[name="description"]', 'content')).toBeTruthy()
  expect(await page.getAttribute('meta[property="og:image"]', 'content')).toMatch(/^https:\/\//)
  expect(await page.getAttribute('link[rel="canonical"]', 'href')).toMatch(/^https:\/\//)
})
