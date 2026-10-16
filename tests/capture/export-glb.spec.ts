import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// npm run export:glb — exports the machine at rest (final materials, canvas placards) to public/m3.glb
// with three's GLTFExporter. The file isn't linked from the page.

type R = { glb(): Promise<string>; ready: Promise<void> }

test('export public/m3.glb', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('render.html')
  await page.waitForFunction(() => !!(window as unknown as { __m3render?: unknown }).__m3render, null, { timeout: 30_000 })
  await page.evaluate(() => (window as unknown as { __m3render: R }).__m3render.ready)
  const b64 = await page.evaluate(() => (window as unknown as { __m3render: R }).__m3render.glb())
  const buf = Buffer.from(b64, 'base64')
  expect(buf.subarray(0, 4).toString('ascii')).toBe('glTF')
  writeFileSync('public/m3.glb', buf)
  console.log(`public/m3.glb: ${(buf.length / 1024).toFixed(0)} KB`)
})
