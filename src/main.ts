import '@fontsource/m-plus-rounded-1c/latin-500.css'
import '@fontsource/m-plus-rounded-1c/latin-900.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import 'lenis/dist/lenis.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sections.css'
import './styles/motion.css'

import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CONTACT_EMAIL } from './content/site.ts'
import { t, type CopyId } from './content/copy.ts'
import { getSections, measure, sectionAt, stickyProgress } from './ui/scrollMap.ts'
import { runLoader } from './ui/loader.ts'
import { initReveals } from './ui/reveal.ts'
import type { Stage } from './scene/stage.ts'

gsap.registerPlugin(ScrollTrigger)
document.documentElement.classList.replace('no-js', 'js')

const params = new URLSearchParams(location.search)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = window.matchMedia('(pointer: fine)').matches
// ?static (captures, audits): no intro and no scroll reveals, so every frame is deterministic.
const staticCapture = params.has('static') || params.has('skipintro')

// WebGL2 or not is decided before anything measures the page: without it the scenes are stills and
// text with no pins (html.no-webgl), so the tall pinned layout is never shown. The 3D stage chunk
// still loads lazily, after first paint, on the WebGL path only (and falls back here if it can't start).
let webgl = webgl2Available()
if (!webgl) useStills()

// Intro first (an overlay over the already-painted page; never awaited), then the scroll reveals,
// which hold anything the loader covers until it opens.
if (!staticCapture) {
  void runLoader({ reducedMotion })
  initReveals({ reducedMotion })
}

// Smooth momentum scrolling on desktop only (touch stays native; reduced motion turns it off).
let lenis: Lenis | null = null
if (finePointer && !reducedMotion) {
  lenis = new Lenis({ anchors: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis!.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
}

// ---- Page chrome -------------------------------------------------------------------------------

const nav = document.querySelector<HTMLElement>('[data-nav]')!
const navLinks = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.nav__links a'))
const toggle = nav.querySelector<HTMLButtonElement>('.nav__toggle')!
const behindMenu = [document.querySelector('main'), document.querySelector('body > footer'), document.querySelector('.skip')]

// Mobile menu: the page behind it goes inert while it's open; Esc closes it and returns focus.
function setMenu(open: boolean) {
  const hadFocus = nav.contains(document.activeElement)
  nav.dataset.open = String(open)
  toggle.setAttribute('aria-expanded', String(open))
  behindMenu.forEach((el) => el?.toggleAttribute('inert', open))
  if (open) navLinks[0]?.focus()
  else if (hadFocus && document.activeElement !== document.body) toggle.focus()
}
toggle.addEventListener('click', () => setMenu(nav.dataset.open !== 'true'))
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav.dataset.open === 'true') setMenu(false)
})
window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
  if (e.matches && nav.dataset.open === 'true') setMenu(false)
})

// A nav jump scrolls down, but it shouldn't hide the nav it came from.
let navPinnedUntil = 0
navLinks.forEach((a) =>
  a.addEventListener('click', () => {
    if (nav.dataset.open === 'true') {
      nav.dataset.open = 'false'
      toggle.setAttribute('aria-expanded', 'false')
      behindMenu.forEach((el) => el?.removeAttribute('inert'))
    }
    navPinnedUntil = performance.now() + 2000
  }),
)

// Contact address is TBD: the CTAs lead to the footer, and the footer button is marked unavailable.
document.querySelectorAll<HTMLAnchorElement>('[data-cta]').forEach((a) => {
  if (CONTACT_EMAIL) {
    a.href = `mailto:${CONTACT_EMAIL}`
  } else {
    a.setAttribute('aria-disabled', 'true')
    a.title = 'Contact email to be announced'
    a.addEventListener('click', (e) => e.preventDefault())
  }
})

// Module gallery: tap, click, Enter or Space flips a card between full and returned (hover previews it).
document.querySelectorAll<HTMLButtonElement>('.card__flip').forEach((b) =>
  b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))),
)

const beats = Array.from(document.querySelectorAll<HTMLElement>('[data-beat]'))
const howEl = document.querySelector<HTMLElement>('#how')
const progressFill = document.querySelector<HTMLElement>('[data-progress]')
const dividers = Array.from(document.querySelectorAll<SVGPathElement>('.divider path'))
// The spec drawing's dimension lines draw in (and their labels follow) as the drawing rises into place.
const elevation = document.querySelector<SVGSVGElement>('.elevation')
const dimPaths = Array.from(document.querySelectorAll<SVGPathElement>('.elevation__dims path'))
const dimLabels = document.querySelector<SVGGElement>('.elevation__labels')
;[...dividers, ...dimPaths].forEach((p) => {
  const len = p.getTotalLength()
  p.style.strokeDasharray = `${len}`
  p.style.strokeDashoffset = reducedMotion ? '0' : `${len}`
  p.dataset.len = String(len)
})

let lastY = 0

function chrome(scrollY: number) {
  const vh = window.innerHeight
  const sections = getSections()
  if (!sections.length) return

  // Nav takes the tone of the section under it, marks the current section, hides on scroll down.
  const under = sections[sectionAt(scrollY + 36)]
  nav.dataset.tone = under.tone
  const current = sections[sectionAt(scrollY + vh * 0.4)].navId
  navLinks.forEach((l) => l.setAttribute('aria-current', String(l.hash === `#${current}`)))
  const down = scrollY > lastY + 2
  const up = scrollY < lastY - 2
  if (scrollY < vh * 0.6 || up || performance.now() < navPinnedUntil) nav.dataset.hidden = 'false'
  else if (down && nav.dataset.open !== 'true' && !nav.contains(document.activeElement)) nav.dataset.hidden = 'true'
  lastY = scrollY

  // How it works: which beat is lit, and the progress rail (reduced motion: it steps with the beats
  // instead of following the scroll). Without WebGL the beats are plain text and there is no rail.
  if (howEl && webgl) {
    const p = stickyProgress(howEl, scrollY, vh)
    const active = p < 0.34 ? 0 : p < 0.7 ? 1 : 2
    beats.forEach((el, i) => (el.dataset.active = String(i === active)))
    if (progressFill) progressFill.style.transform = `scaleX(${reducedMotion ? (active + 1) / beats.length : p})`
  }

  // Dividers draw as they cross the lower half of the viewport.
  if (!reducedMotion) {
    for (const p of dividers) {
      const r = p.ownerSVGElement!.getBoundingClientRect()
      const k = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.6)))
      p.style.strokeDashoffset = String(Number(p.dataset.len) * (1 - k))
    }
    if (elevation) {
      const r = elevation.getBoundingClientRect()
      const k = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.5)))
      for (const p of dimPaths) p.style.strokeDashoffset = String(Number(p.dataset.len) * (1 - Math.min(1, k * 1.25)))
      if (dimLabels) dimLabels.style.opacity = String(Math.min(1, Math.max(0, (k - 0.7) / 0.3)))
    }
  }
}

// ---- 3D stage, after first paint ----------------------------------------------------------------

let stage: Stage | null = null
const host = document.querySelector<HTMLElement>('[data-stage]')!

function webgl2Available(): boolean {
  if (params.has('nowebgl')) return false
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    if (!gl) return false
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return !/swiftshader|llvmpipe|software/i.test(name)
  } catch {
    return false
  }
}

function useStills() {
  document.documentElement.classList.add('no-webgl')
  document.documentElement.dataset.gl = 'none'
  showStills()
}

// Without WebGL each scene shows a rendered still (public/stills/*, made by npm run render:assets,
// all rendered at 1100 × 1300: tests/capture/assets.spec.ts). The size attributes reserve the box,
// and each load re-measures anyway, so the section map never goes stale.
function showStills() {
  const stills: Array<[string, string, CopyId]> = [
    ['#top .hero', 'hero', 'still.hero'],
    ['#how .split', 'swap', 'still.swap'],
    ['[data-scene="exploded"] .split', 'exploded', 'still.exploded'],
    ['#connected .split', 'unlock', 'still.unlock'],
  ]
  for (const [sel, name, alt] of stills) {
    const host = document.querySelector(sel)
    if (!host) continue
    const img = document.createElement('img')
    img.className = 'still'
    img.src = `${import.meta.env.BASE_URL}stills/${name}.webp`
    img.alt = t(alt)
    img.width = 1100
    img.height = 1300
    img.loading = 'lazy'
    img.decoding = 'async'
    img.addEventListener('load', () => refresh(), { once: true })
    host.append(img)
    host.classList.add('has-still')
    // The still's alt now describes the scene; the text equivalent describes an animation that
    // doesn't play on this path, so screen readers skip it.
    host.closest('[data-scene]')?.querySelector(':scope > .sr-only[data-copy$=".alt"]')?.setAttribute('aria-hidden', 'true')
  }
}

async function bootStage() {
  if (!webgl) return
  try {
    const { startStage } = await import('./scene/stage.ts')
    stage = startStage(host, { reducedMotion })
    document.documentElement.dataset.gl = 'webgl2'
    stage.frame(currentY(), performance.now())
    document.documentElement.dataset.stageReady = 'true'
  } catch (err) {
    // The probe passed but the stage didn't start (the chunk failed to load, the driver refused the
    // context): switch to the stills path and re-measure, rather than keep pinned scenes with no machine.
    if (import.meta.env.DEV) console.warn('[stage] fell back to stills:', err)
    stage = null
    webgl = false
    host.replaceChildren()
    beats.forEach((el) => delete el.dataset.active)
    useStills()
    refresh()
  }
}

// ---- Loop ----------------------------------------------------------------------------------------

const currentY = () => (lenis ? lenis.scroll : window.scrollY)

function refresh() {
  measure()
  stage?.resize()
  ScrollTrigger.refresh()
}
window.addEventListener('resize', refresh)
document.fonts?.ready.then(refresh)
refresh()

gsap.ticker.add(() => {
  const y = currentY()
  chrome(y)
  stage?.frame(y, performance.now())
})

// Dev-only hook for capture tests: jump straight to a scroll position.
if (import.meta.env.DEV) {
  ;(window as unknown as { __m3: object }).__m3 = {
    scrollTo: (y: number) => (lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)),
  }
}

const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 800 }) : setTimeout(cb, 200))
if (document.readyState === 'complete') idle(bootStage)
else window.addEventListener('load', () => idle(bootStage), { once: true })
