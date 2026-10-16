import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

// Phase 3: door interaction in the hero, by pointer and by keyboard. Captures into docs/checkpoints/phase-3.
const OUT = 'docs/checkpoints/phase-3'
mkdirSync(OUT, { recursive: true })

test('hero interaction: hover frames a door, click opens it, keyboard steps the cycle', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text())
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('./?skipintro')
  await page.waitForFunction(() => document.documentElement.dataset.stageReady === 'true', null, { timeout: 30_000 })
  await page.waitForTimeout(600)

  // Hotspots are active in the hero.
  const hotspots = page.locator('.hotspot')
  await expect(page.locator('.hotspots')).toBeVisible()
  expect(await hotspots.count()).toBe(12)

  // Pointer: hover then click the door under hotspot 3.
  const box = await hotspots.nth(2).boundingBox()
  expect(box).not.toBeNull()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  await page.mouse.move(cx, cy)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/interaction-01-hover.jpg`, type: 'jpeg', quality: 86 })
  await page.mouse.click(cx, cy)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/interaction-02-open.jpg`, type: 'jpeg', quality: 86 })
  await page.mouse.click(cx, cy)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/interaction-03-pulled.jpg`, type: 'jpeg', quality: 86 })

  // Keyboard: focus the first hotspot, step its door, move right, rotate, reset.
  await hotspots.first().focus()
  await expect(hotspots.first()).toHaveAttribute('aria-label', /door 1: plugged in\. Unlock and open/)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  await expect(page.locator('main > [aria-live="polite"]')).toContainText('unlocked, door open')
  await page.keyboard.press('ArrowRight')
  await expect(hotspots.nth(1)).toBeFocused()
  await page.keyboard.press('Shift+ArrowLeft')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/interaction-04-keyboard.jpg`, type: 'jpeg', quality: 86 })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(900)

  // Drag turns the machine (and never scrolls the page sideways).
  await page.mouse.move(1000, 500)
  await page.mouse.down()
  await page.mouse.move(1150, 500, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/interaction-05-drag.jpg`, type: 'jpeg', quality: 86 })

  // Leaving the hero hides the controls and resets the doors.
  await page.evaluate(() => (window as unknown as { __m3: { scrollTo: (y: number) => void } }).__m3.scrollTo(window.innerHeight * 1.2))
  await page.waitForTimeout(800)
  await expect(page.locator('.hotspots')).toBeHidden()
  expect(problems).toEqual([])
})
