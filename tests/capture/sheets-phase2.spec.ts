import { test } from '@playwright/test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// Phase 2 contact sheets: every section capture at 1440 px and at 390 px, labeled.
// Output: docs/checkpoints/phase-2/sheet-{desktop,mobile}.jpg

const DIR = 'docs/checkpoints/phase-2'

for (const vp of [
  { label: 'desktop', cols: 3, title: '1440 px' },
  { label: 'mobile', cols: 8, title: '390 px' },
]) {
  test(`phase 2 sheet · ${vp.label}`, async ({ page }) => {
    const files = readdirSync(DIR)
      .filter((f) => f.startsWith(`${vp.label}-`) && f.endsWith('.jpg'))
      .sort()
    const cells = files
      .map((f) => {
        const p = `${DIR}/${f}`
        const src = existsSync(p) ? `data:image/jpeg;base64,${readFileSync(p).toString('base64')}` : ''
        const label = f.replace(`${vp.label}-`, '').replace('.jpg', '').replace(/^\d+b?-/, '').replace(/-/g, ' ')
        return `<figure><img src="${src}" alt=""><figcaption>${label}</figcaption></figure>`
      })
      .join('')
    const width = 2400
    await page.setViewportSize({ width, height: 1200 })
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; padding: 40px; background: #15161A; color: #F3EFE7; font: 500 22px/1.3 system-ui, sans-serif; width: ${width - 80}px; }
      h1 { margin: 0 0 28px; font-size: 30px; font-weight: 600; } h1 span { color: #12D6FF; }
      .grid { display: grid; grid-template-columns: repeat(${vp.cols}, 1fr); gap: 18px; }
      figure { margin: 0; } img { width: 100%; display: block; border-radius: 10px; }
      figcaption { margin-top: 8px; color: #7F8187; font: 500 16px/1.3 ui-monospace, Consolas, monospace; }
    </style><h1><span>m³</span> Phase 2 page skeleton · ${vp.title}</h1><div class="grid">${cells}</div>`)
    await page.waitForLoadState('load')
    await page.screenshot({ path: `${DIR}/sheet-${vp.label}.jpg`, fullPage: true, type: 'jpeg', quality: 82 })
  })
}
