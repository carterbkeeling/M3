import { test, expect } from '@playwright/test'

// Phase 1 step 2: confirm Playwright can drive Edge and get a hardware-backed WebGL2 context.
test('edge launches with WebGL2', async ({ page, browserName }) => {
  await page.goto('./')
  const info = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return { webgl2: false, renderer: 'none', ua: navigator.userAgent }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    return { webgl2: true, renderer, ua: navigator.userAgent }
  })
  console.log(`[smoke] ${browserName} | webgl2=${info.webgl2} | renderer=${info.renderer}`)
  console.log(`[smoke] ua=${info.ua}`)
  expect(info.webgl2).toBe(true)
})
