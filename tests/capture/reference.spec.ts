import { test, type Browser, type BrowserContextOptions, type Page } from '@playwright/test'
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Reference study of landonorris.com (Phase 1, step 4). We borrow its FEEL only:
// these captures stay in the gitignored reference/ folder and are never committed.
// The test is deliberately assertion-free so it never fails on content changes.
//
// Run: npx.cmd playwright test tests/capture/reference.spec.ts
// Outputs (all under reference/):
//   loader-{desktop,mobile}-NNNN.png   loader frames at NNNN ms after navigation start
//   loader-{desktop,mobile}.json       loader overlay timeline (opacity / transform / rect)
//   hero-settled.png                   hero once the loader has gone
//   hero-cursor-{a..d}[-early].png     hero with the mouse at four positions (0.4 s and 2.5 s after arrival)
//   desktop-NN.png / mobile-NN.png     the page, scrolled top to bottom in smooth wheel steps
//   {desktop,mobile}-scroll.json       per-shot scrollY, nav state and background under the viewport center
//   nav-{down,up}.png                  nav after scrolling down, then back up
//   hover-*-{off,mid,on}.png           card / button hover states (rest, ~0.35 s, ~1.35 s)
//   menu-{desktop,mobile}.png          the open menu
//   dom-{desktop,mobile}.json          fonts, type styles, color usage counts
//   videos/{desktop,mobile}.webm       screen recordings (only with REF_VIDEO=1, needs ffmpeg)

const URL = 'https://landonorris.com'
const OUT = 'reference'
const VIDEO_DIR = join(OUT, 'videos')
mkdirSync(OUT, { recursive: true })

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const log = (msg: string) => console.log(`[reference] ${msg}`)

// Video needs Playwright's ffmpeg build (`npx.cmd playwright install ffmpeg`, a separate download),
// so it is opt-in: set REF_VIDEO=1 once ffmpeg is installed.
const RECORD_VIDEO = process.env.REF_VIDEO === '1'

/** Open a fresh context (no stored cookies), optionally recording video into reference/videos. */
async function openContext(browser: Browser, opts: BrowserContextOptions) {
  const size = opts.viewport ?? { width: 1440, height: 900 }
  if (RECORD_VIDEO) mkdirSync(VIDEO_DIR, { recursive: true })
  const context = await browser.newContext({
    ...opts,
    ...(RECORD_VIDEO ? { recordVideo: { dir: VIDEO_DIR, size } } : {}),
    reducedMotion: 'no-preference',
    colorScheme: 'light',
    locale: 'en-US',
  })
  const page = await context.newPage()
  return { context, page }
}

/** Close the context and give the recorded video a stable name. */
async function closeWithVideo(page: Page, name: string) {
  const video = page.video()
  await page.context().close()
  if (!video) return
  try {
    const src = await video.path()
    const dst = join(VIDEO_DIR, `${name}.webm`)
    if (existsSync(dst)) rmSync(dst)
    renameSync(src, dst)
  } catch (err) {
    log(`video rename failed: ${String(err)}`)
  }
}

/**
 * Navigate and photograph the loader at fixed offsets while recording a timeline of any
 * full-viewport overlay (fixed/absolute, opaque background) so we can read its timing.
 */
async function captureLoader(page: Page, prefix: string, frames: number[]) {
  const timeline: unknown[] = []
  const t0 = Date.now()
  await page.goto(URL, { waitUntil: 'commit', timeout: 90_000 })
  const pending = [...frames]
  while (Date.now() - t0 < 9000) {
    const t = Date.now() - t0
    if (pending.length && t >= pending[0]) {
      const at = pending.shift() as number
      await page.screenshot({ path: `${OUT}/loader-${prefix}-${pad(at, 4)}.png` }).catch(() => {})
    }
    const snap = await page
      .evaluate(() => {
        const w = window as unknown as { __refOverlays?: Element[] }
        if (!w.__refOverlays || w.__refOverlays.length === 0) {
          w.__refOverlays = [...document.querySelectorAll('body *')].filter((el) => {
            const cs = getComputedStyle(el)
            if (cs.position !== 'fixed' && cs.position !== 'absolute') return false
            const r = el.getBoundingClientRect()
            const opaque = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent'
            return opaque && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9
          }).slice(0, 6)
        }
        const overlays = w.__refOverlays.map((el) => {
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          return {
            cls: String(el.className).slice(0, 60),
            bg: cs.backgroundColor,
            op: cs.opacity,
            disp: cs.display,
            vis: cs.visibility,
            tf: cs.transform,
            clip: cs.clipPath,
            rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          }
        })
        const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
        return { overlays, center: top ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}` : 'none' }
      })
      .catch((e: unknown) => ({ error: String(e).slice(0, 80) }))
    timeline.push({ t, ...snap })
    await page.waitForTimeout(100)
  }
  for (const at of pending) await page.screenshot({ path: `${OUT}/loader-${prefix}-${pad(at, 4)}.png` }).catch(() => {})
  writeFileSync(`${OUT}/loader-${prefix}.json`, JSON.stringify(timeline, null, 1))
}

/** Wait until no opaque full-viewport overlay covers the page center (loader finished). */
async function waitForLoaderDone(page: Page) {
  await page
    .waitForFunction(
      () => {
        const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
        for (let n: Element | null = top; n; n = n.parentElement) {
          const cs = getComputedStyle(n)
          const m = cs.backgroundColor.match(/[\d.]+/g)
          if (!m) continue
          const [r, g, b, a = 1] = m.map(Number)
          if (a > 0.5 && g > 230 && r > 170 && b < 80) return false // the lime loader
        }
        return document.readyState === 'complete'
      },
      undefined,
      { timeout: 30_000, polling: 200 },
    )
    .catch(() => log('loader wait timed out; continuing'))
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(2000)
}

/**
 * Close a cookie banner if one is present, using only the most privacy-preserving choice.
 * Never clicks anything that reads as accept / allow / agree.
 */
async function declineCookies(page: Page) {
  const decline = /^(reject( all)?|decline( all)?|deny( all)?|refuse( all)?|(use )?(only )?(strictly )?necessary( cookies)?( only)?|essential( cookies)?( only)?|continue without accepting|close)$/i
  const accept = /accept|allow|agree|got it|^ok/i
  const containers = page.locator(
    '[id*=cookie i], [class*=cookie i], [id*=consent i], [class*=consent i], [id*=onetrust i], [id*=Cookiebot i], [class*=cmp i], [aria-label*=cookie i]',
  )
  if ((await containers.count().catch(() => 0)) === 0) {
    log('no cookie banner found')
    return
  }
  const buttons = containers.locator('button, a, [role=button]')
  const n = await buttons.count().catch(() => 0)
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i)
    const text = ((await b.innerText().catch(() => '')) || (await b.getAttribute('aria-label').catch(() => '')) || '').trim()
    if (!text || accept.test(text) || !decline.test(text)) continue
    if (!(await b.isVisible().catch(() => false))) continue
    await b.click({ timeout: 5000 }).catch(() => {})
    log(`cookie banner: clicked "${text}"`)
    await page.waitForTimeout(800)
    return
  }
  log('cookie-like elements present but no visible decline/close control; left untouched')
}

/** Smoothly wheel-scroll from top to bottom, screenshotting each step. */
async function scrollCapture(page: Page, prefix: string, mobile: boolean) {
  await page.mouse.move(mobile ? 195 : 1400, mobile ? 420 : 450)
  const vh = page.viewportSize()?.height ?? 900
  const stepPx = Math.round(vh * 0.6)
  const meta: unknown[] = []
  let lastY = -1
  let stuck = 0
  for (let i = 1; i <= 60; i++) {
    const state = await page.evaluate(() => {
      const nav = document.querySelector('.nav')
      const navCs = nav ? getComputedStyle(nav) : null
      const navR = nav ? nav.getBoundingClientRect() : null
      let bgUnder = 'none'
      const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
      for (let n: Element | null = top; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          bgUnder = `${bg} (${n.tagName.toLowerCase()}.${String(n.className).split(' ').slice(0, 2).join('.')})`
          break
        }
      }
      const section = [...document.querySelectorAll('section')].find((s) => {
        const r = s.getBoundingClientRect()
        return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2
      })
      return {
        scrollY: Math.round(scrollY),
        max: document.documentElement.scrollHeight - innerHeight,
        section: section ? String(section.className) : 'none',
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bgUnder,
        nav: nav && navCs && navR ? { top: Math.round(navR.top), tf: navCs.transform, color: navCs.color, cls: String(nav.className) } : null,
      }
    })
    await page.screenshot({ path: `${OUT}/${prefix}-${pad(i)}.png` })
    meta.push({ shot: `${prefix}-${pad(i)}.png`, ...state })
    if (state.scrollY >= state.max - 4) break
    stuck = state.scrollY === lastY ? stuck + 1 : 0
    if (stuck >= 2) break
    lastY = state.scrollY
    // Smooth: several small wheel ticks, then let Lenis / ScrollTrigger settle.
    const before = state.scrollY
    for (let k = 0; k < 4; k++) {
      await page.mouse.wheel(0, stepPx / 4)
      await page.waitForTimeout(90)
    }
    await page.waitForTimeout(1100)
    const after = await page.evaluate(() => scrollY)
    if (Math.abs(after - before) < 4) {
      // Touch emulation can swallow wheel events: fall back to a native smooth scroll.
      await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), stepPx)
      await page.waitForTimeout(1100)
    }
  }
  writeFileSync(`${OUT}/${prefix}-scroll.json`, JSON.stringify(meta, null, 1))
  log(`${prefix}: ${meta.length} scroll shots`)
}

/** Scroll an element to the viewport center with wheel ticks (plays nicely with Lenis). */
async function wheelTo(page: Page, selector: string, nth = 0) {
  for (let i = 0; i < 40; i++) {
    const dy = await page.evaluate(
      ({ selector, nth }) => {
        const el = document.querySelectorAll(selector)[nth]
        if (!el) return 0
        const r = el.getBoundingClientRect()
        return Math.round(r.top + r.height / 2 - innerHeight / 2)
      },
      { selector, nth },
    )
    if (Math.abs(dy) < 30) break
    await page.mouse.wheel(0, Math.max(-800, Math.min(800, dy)))
    await page.waitForTimeout(450)
  }
  await page.waitForTimeout(1000)
}

/** Dump the type and color system as computed in the browser. */
async function dumpDom(page: Page, name: string) {
  const dom = await page.evaluate(() => {
    const colors = new Map<string, number>()
    const bgs = new Map<string, number>()
    const type = new Map<string, { n: number; sample: string }>()
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || cs.display === 'none') continue
      bgs.set(cs.backgroundColor, (bgs.get(cs.backgroundColor) ?? 0) + 1)
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? '').trim())
      if (!own) continue
      colors.set(cs.color, (colors.get(cs.color) ?? 0) + 1)
      const key = `${cs.fontFamily.split(',')[0]} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ls=${cs.letterSpacing} ${cs.textTransform}`
      const cur = type.get(key) ?? { n: 0, sample: (el.textContent ?? '').trim().slice(0, 40) }
      cur.n++
      type.set(key, cur)
    }
    const sort = <T,>(m: Map<string, T>, by: (v: T) => number) => [...m.entries()].sort((a, b) => by(b[1]) - by(a[1]))
    const rootVars: Record<string, string> = {}
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && /:root|html|body/.test(rule.selectorText)) {
            for (const prop of rule.style) if (prop.startsWith('--')) rootVars[prop] = rule.style.getPropertyValue(prop).trim()
          }
        }
      } catch {
        /* cross-origin sheet */
      }
    }
    return {
      viewport: [innerWidth, innerHeight],
      scrollHeight: document.documentElement.scrollHeight,
      fonts: [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style} ${f.status}`),
      textColors: sort(colors, (v) => v).slice(0, 20),
      backgrounds: sort(bgs, (v) => v).slice(0, 20),
      typeStyles: sort(type, (v) => v.n).slice(0, 40),
      rootVars,
    }
  })
  writeFileSync(`${OUT}/dom-${name}.json`, JSON.stringify(dom, null, 1))
}

/** Hover off/on screenshots of the first few elements matching selector, clipped with padding. */
async function hoverPair(
  page: Page,
  selector: string,
  label: string,
  count: number,
  park: { x: number; y: number },
  padPx = 40,
  scrollTarget?: string, // scroll this into view instead (for elements inside pinned/stacked sections)
) {
  const total = await page.locator(selector).count().catch(() => 0)
  if (total === 0) {
    log(`hover: no ${selector}`)
    return
  }
  for (let i = 0; i < Math.min(count, total); i++) {
    if (scrollTarget) await wheelTo(page, scrollTarget)
    else await wheelTo(page, selector, i)
    const el = page.locator(selector).nth(i)
    if (!(await el.isVisible().catch(() => false))) {
      log(`hover: ${label} #${i + 1} not visible`)
      continue
    }
    const box = await el.boundingBox().catch(() => null)
    if (!box) continue
    const vp = page.viewportSize() ?? { width: 1440, height: 900 }
    const x = Math.max(0, box.x - padPx)
    const y = Math.max(0, box.y - padPx)
    const right = Math.min(vp.width, box.x + box.width + padPx)
    const bottom = Math.min(vp.height, box.y + box.height + padPx)
    const clip = { x, y, width: right - x, height: bottom - y }
    if (clip.width < 8 || clip.height < 8) {
      log(`hover: ${label} #${i + 1} off-screen`)
      continue
    }
    await page.mouse.move(park.x, park.y, { steps: 8 })
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/hover-${label}-${i + 1}-off.png`, clip })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${OUT}/hover-${label}-${i + 1}-mid.png`, clip })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT}/hover-${label}-${i + 1}-on.png`, clip })
  }
  await page.mouse.move(park.x, park.y, { steps: 8 })
}

test('reference: desktop 1440x900', async ({ browser }) => {
  test.setTimeout(900_000)
  const { page } = await openContext(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  try {
    await captureLoader(page, 'desktop', [300, 600, 900, 1200, 1600, 2000, 2600, 3400, 4500])
    await waitForLoaderDone(page)
    await declineCookies(page)
    await page.screenshot({ path: `${OUT}/hero-settled.png` })

    // Cursor-reactive hero: mouse eased to several positions; one frame shortly after arrival,
    // one after the effect has had time to catch up (the reveal lens trails the cursor).
    const spots: Array<[string, number, number]> = [
      ['a', 380, 300],
      ['b', 1060, 620],
      ['c', 720, 260],
      ['d', 720, 430],
    ]
    for (const [tag, x, y] of spots) {
      await page.mouse.move(x, y, { steps: 25 })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT}/hero-cursor-${tag}-early.png` })
      await page.waitForTimeout(2100)
      await page.screenshot({ path: `${OUT}/hero-cursor-${tag}.png` })
    }

    await dumpDom(page, 'desktop')
    await scrollCapture(page, 'desktop', false)

    // Nav behavior: from mid-page, scroll down (nav hides?) then up (nav returns?).
    await page.evaluate(() => window.scrollTo({ top: 0 }))
    await page.waitForTimeout(1500)
    await wheelTo(page, 'section.home-helmets')
    for (let k = 0; k < 4; k++) {
      await page.mouse.wheel(0, 150)
      await page.waitForTimeout(80)
    }
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT}/nav-down.png` })
    for (let k = 0; k < 3; k++) {
      await page.mouse.wheel(0, -120)
      await page.waitForTimeout(80)
    }
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT}/nav-up.png` })

    // Hover mechanics: helmet cards (image swap) and a text CTA button. (The on/off-track
    // buttons sit under a stacked full-bleed image once scrolled to, so they are not hovered.)
    await hoverPair(page, '.helmet-grid-item', 'helmet', 3, { x: 1430, y: 20 })
    await hoverPair(page, 'section a.btn-w:not(.icon-only):not(.is-nav)', 'cta', 1, { x: 1430, y: 20 }, 60)

    // Menu: open it (UI only, no navigation) and photograph.
    await page.evaluate(() => window.scrollTo({ top: 0 }))
    await page.waitForTimeout(1500)
    const ham = page.locator('button.nav-ham').first()
    if (await ham.isVisible().catch(() => false)) {
      await ham.hover().catch(() => {})
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/hover-nav-ham.png`, clip: { x: 1100, y: 0, width: 340, height: 110 } })
      await ham.click().catch(() => {})
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT}/menu-desktop-0400.png` })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${OUT}/menu-desktop.png` })
    }
  } finally {
    await closeWithVideo(page, 'desktop')
  }
})

test('reference: mobile 390x844', async ({ browser }) => {
  test.setTimeout(900_000)
  const { page } = await openContext(browser, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  try {
    await captureLoader(page, 'mobile', [300, 1200, 2600])
    await waitForLoaderDone(page)
    await declineCookies(page)
    await dumpDom(page, 'mobile')
    await scrollCapture(page, 'mobile', true)

    await page.evaluate(() => window.scrollTo({ top: 0 }))
    await page.waitForTimeout(1500)
    const ham = page.locator('button.nav-ham').first()
    if (await ham.isVisible().catch(() => false)) {
      await ham.tap().catch(() => ham.click().catch(() => {}))
      await page.waitForTimeout(1600)
      await page.screenshot({ path: `${OUT}/menu-mobile.png` })
    }
  } finally {
    await closeWithVideo(page, 'mobile')
  }
})
