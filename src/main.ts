import '@fontsource/m-plus-rounded-1c/latin-500.css'
import '@fontsource/m-plus-rounded-1c/latin-900.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import 'lenis/dist/lenis.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sections.css'

import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CONTACT_EMAIL } from './content/site.ts'
import { getSections, measure, sectionAt, stickyProgress } from './ui/scrollMap.ts'
import type { Stage } from './scene/stage.ts'

gsap.registerPlugin(ScrollTrigger)
document.documentElement.classList.replace('no-js', 'js')

const params = new URLSearchParams(location.search)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = window.matchMedia('(pointer: fine)').matches

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
dividers.forEach((p) => {
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

  // How it works: which beat is lit, and the progress rail.
  if (howEl) {
    const p = stickyProgress(howEl, scrollY, vh)
    const active = p < 0.34 ? 0 : p < 0.7 ? 1 : 2
    beats.forEach((el, i) => (el.dataset.active = String(i === active)))
    if (progressFill) progressFill.style.transform = `scaleX(${p})`
  }

  // Dividers draw as they cross the lower half of the viewport.
  if (!reducedMotion) {
    for (const p of dividers) {
      const r = p.ownerSVGElement!.getBoundingClientRect()
      const k = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.6)))
      p.style.strokeDashoffset = String(Number(p.dataset.len) * (1 - k))
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

async function bootStage() {
  if (!webgl2Available()) {
    document.documentElement.classList.add('no-webgl')
    document.documentElement.dataset.gl = 'none'
    return
  }
  const { startStage } = await import('./scene/stage.ts')
  stage = startStage(host, { reducedMotion })
  document.documentElement.dataset.gl = 'webgl2'
  stage.frame(currentY(), performance.now())
  document.documentElement.dataset.stageReady = 'true'
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
