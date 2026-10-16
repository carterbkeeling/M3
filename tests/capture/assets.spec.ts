import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// npm run render:assets — renders the no-WebGL stills, the gallery card art and the OG image with
// the final materials, into public/. Stamps public/stills/manifest.json with a hash of config.ts so
// the build can warn when the stills are stale.

type R = { still(name: string, w: number, h: number): Promise<string>; og(): Promise<string>; ready: Promise<void> }

const STILLS: Array<[string, number, number]> = [
  ['hero', 1100, 1300],
  ['swap', 1100, 1300],
  ['exploded', 1100, 1300],
  ['unlock', 1100, 1300],
  ['module-full', 800, 600],
  ['module-returned', 800, 600],
]

const save = (path: string, dataUrl: string) => writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'))

test('render stills, card art and OG image', async ({ page }) => {
  test.setTimeout(180_000)
  mkdirSync('public/stills', { recursive: true })
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(e.message))
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto('render.html')
  await page.waitForFunction(() => !!(window as unknown as { __m3render?: unknown }).__m3render, null, { timeout: 30_000 })
  await page.evaluate(() => (window as unknown as { __m3render: R }).__m3render.ready)
  for (const [name, w, h] of STILLS) {
    const url = await page.evaluate(([n, ww, hh]) => (window as unknown as { __m3render: R }).__m3render.still(n as string, ww as number, hh as number), [name, w, h])
    expect(url.startsWith('data:image/webp')).toBe(true)
    save(`public/stills/${name}.webp`, url)
  }
  save('public/og.png', await page.evaluate(() => (window as unknown as { __m3render: R }).__m3render.og()))
  const hash = createHash('sha256').update(readFileSync('src/model/config.ts')).digest('hex').slice(0, 16)
  writeFileSync('public/stills/manifest.json', JSON.stringify({ configHash: hash, rendered: STILLS.map(([n]) => n) }, null, 2) + '\n')
  expect(problems).toEqual([])
})
