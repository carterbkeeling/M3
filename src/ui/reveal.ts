// Scroll reveals, each played once as its element enters the viewport (IntersectionObserver):
//   - .display headings: each child <span> line rises and fades in, staggered, the small .dim line first
//   - .lede, section paragraphs, part labels, function rows, facts, gallery cards: a subtle fade-up
//   - short .caption labels (< 40 characters on one line): a monospace block-cursor type-in
//   - spec table rows: stagger in
// Elements entering together play in document order with a small stagger. Easing is the page's
// --ease token, cubic-bezier(0.65, 0.05, 0, 1).
//
// Safe by construction:
//   - Content is visible without JS: start states apply only under html.js-reveal, which this adds.
//   - Reduced motion: nothing is hidden and nothing animates.
//   - The hero is left alone (the loader reveals it, and its text may be the LCP element).
//   - Anything already on screen at init stays visible, unless the loader is covering it, in which
//     case it plays when the loader opens.
//   - Nothing stays hidden if a trigger misses: a sweep on scroll, on focus, before print and on
//     timers after load reveals anything pending that is on screen (animated) or already scrolled
//     past (at once).
//   - Inline styles are cleared when each reveal ends, so the page's own CSS is back in charge.
//
//   import { initReveals } from './ui/reveal.ts'
//   initReveals({ reducedMotion })
//
// Opt an element (or a whole block) out with data-reveal-skip. Styles: src/styles/motion.css.

import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

export interface RevealOptions {
  reducedMotion: boolean
}

/** The page's easing token (--ease in tokens.css). */
const EASE = CustomEase.create('m3-ease', '0.65,0.05,0,1')

type Kind = 'lines' | 'row' | 'type' | 'fade'

/** Targets, by priority (an element takes the first kind that matches). */
const TARGETS: Array<[Kind, string]> = [
  ['lines', '.display'],
  ['row', '.spec tbody > tr'],
  ['type', '.caption'],
  [
    'fade',
    [
      '.lede',
      '.copy > p',
      '.narrow > p',
      '.statement',
      '.gallery__note',
      '.labels > li',
      '.functions > li',
      '.facts > div',
      '.cards > li',
      '.footer__cta',
    ].join(','),
  ],
]
/** Where reveals live: page sections (and the footer), minus the hero and anything opted out. */
const SCOPE = '.s'
const EXCLUDE = '.s--hero, [data-reveal-skip], .nav, .m3-loader'
const TYPE_MAX_CHARS = 40

/** Motion (seconds). */
const M = {
  lines: { dur: 1.1, stagger: 0.12, rise: 55 }, // rise in % of each line's own height
  fade: { dur: 0.9, rise: 18 }, // px
  row: { dur: 0.7, rise: 10 },
  type: { perChar: 0.028, blinks: 2, blink: 0.11 },
  step: { lines: 0.1, fade: 0.08, type: 0.06, row: 0.05 } as Record<Kind, number>, // stagger between units entering together
  maxDelay: 0.9,
  holdForLoader: 2.5, // never wait on the loader longer than this
  sweepEvery: 200, // ms between scroll-driven sweeps
  sweepAfterLoad: [1200, 4000], // ms after load: fallback sweeps
} as const

interface Unit {
  el: HTMLElement
  kind: Kind
  tween?: gsap.core.Animation
}

let started = false

/** Hide every reveal target below the fold and play each once as it scrolls into view. */
export function initReveals(opts: RevealOptions): void {
  if (started || opts.reducedMotion) return
  if (typeof IntersectionObserver === 'undefined') return
  started = true
  const html = document.documentElement
  try {
    setup(html)
  } catch (err) {
    // Never leave anything hidden because of a bug here.
    html.classList.remove('js-reveal')
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => el.removeAttribute('data-reveal'))
    if (import.meta.env.DEV) console.warn('[reveal] disabled:', err)
  }
}

function setup(html: HTMLElement): void {
  const units = new Map<HTMLElement, Unit>()
  const pending = new Set<Unit>()
  const queue: Unit[] = []
  let held = html.dataset.loader === 'running'
  let flushQueued = false

  // ---- Collect ----
  for (const [kind, selector] of TARGETS) {
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (units.has(el) || !el.closest(SCOPE) || el.closest(EXCLUDE)) return
      units.set(el, { el, kind })
    })
  }

  // ---- Decide the start state: hide what is below the fold (and what the loader is covering) ----
  const vh = innerHeight
  html.classList.add('js-reveal')
  for (const u of units.values()) {
    const r = u.el.getBoundingClientRect()
    const passed = r.bottom <= 0 && r.height > 0
    const inView = r.top < vh && r.bottom > 0
    if (passed || (inView && !held)) {
      u.el.dataset.reveal = 'done'
      continue
    }
    u.el.dataset.reveal = 'pending'
    pending.add(u)
  }
  if (!pending.size) return

  // ---- Play ----
  const finish = (u: Unit) => {
    u.tween = undefined
    u.el.dataset.reveal = 'done'
  }

  const showNow = (u: Unit) => {
    if (!pending.delete(u) && !u.tween) return
    io.unobserve(u.el)
    u.tween?.progress(1).kill()
    gsap.set(u.kind === 'lines' ? [u.el, ...lineSpans(u.el)] : u.el, { clearProps: 'transform,opacity,clipPath' })
    u.el.querySelector(':scope > .rv-cursor')?.remove()
    finish(u)
  }

  const play = (u: Unit, delay: number) => {
    if (!pending.delete(u)) return
    io.unobserve(u.el)
    const done = () => finish(u)
    if (u.kind === 'lines') u.tween = playLines(u.el, delay, done)
    else if (u.kind === 'row') u.tween = playFade(u.el, delay, M.row.dur, M.row.rise, done)
    else if (u.kind === 'type') u.tween = playType(u.el, delay, done) ?? playFade(u.el, delay, M.fade.dur, M.fade.rise, done)
    else u.tween = playFade(u.el, delay, M.fade.dur, M.fade.rise, done)
  }

  const flush = () => {
    flushQueued = false
    if (held || !queue.length) return
    const batch = queue.splice(0).sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    let delay = 0
    for (const u of batch) {
      if (!pending.has(u)) continue
      play(u, Math.min(delay, M.maxDelay))
      delay += M.step[u.kind]
    }
  }

  const enqueue = (u: Unit) => {
    if (!pending.has(u) || queue.includes(u)) return
    queue.push(u)
    if (!flushQueued) {
      flushQueued = true
      requestAnimationFrame(flush)
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const u = units.get(e.target as HTMLElement)
        if (u && e.isIntersecting) enqueue(u)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  )
  pending.forEach((u) => io.observe(u.el))

  // ---- Safety nets ----
  // Anything on screen that is still pending plays now; anything already scrolled past (a nav jump
  // over it) is shown at once, so nothing is ever left hidden behind the reader.
  const sweep = () => {
    if (!pending.size) return
    const h = innerHeight
    for (const u of [...pending]) {
      const r = u.el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue // not rendered (display: none)
      if (r.bottom <= 0) showNow(u)
      else if (r.top < h * 0.92 && !held) enqueue(u) // same line as the observer's rootMargin
    }
  }
  let lastSweep = 0
  let sweepTimer = 0
  const onScroll = () => {
    const now = performance.now()
    window.clearTimeout(sweepTimer)
    if (now - lastSweep >= M.sweepEvery) {
      lastSweep = now
      sweep()
    } else {
      sweepTimer = window.setTimeout(onScroll, M.sweepEvery) // trailing sweep after the scroll stops
    }
  }
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onScroll, { passive: true })

  // Keyboard focus (or find-in-page landing) inside a pending block shows it immediately.
  document.addEventListener('focusin', (e) => {
    const el = (e.target as Element | null)?.closest?.('[data-reveal="pending"]')
    const u = el ? units.get(el as HTMLElement) : undefined
    if (u) showNow(u)
  })
  addEventListener('beforeprint', () => {
    for (const u of units.values()) if (u.tween || pending.has(u)) showNow(u)
  })

  const afterLoad = () => M.sweepAfterLoad.forEach((ms) => window.setTimeout(sweep, ms))
  if (document.readyState === 'complete') afterLoad()
  else addEventListener('load', afterLoad, { once: true })

  // ---- Loader hand-off: in-view reveals wait for the overlay to open ----
  if (held) {
    const release = () => {
      if (!held) return
      held = false
      sweep()
      flush()
    }
    addEventListener('m3:loader-open', release, { once: true })
    addEventListener('m3:loader-done', release, { once: true })
    window.setTimeout(release, M.holdForLoader * 1000)
  }
}

// ---- The motions ------------------------------------------------------------------------------------

function lineSpans(el: HTMLElement): HTMLElement[] {
  return Array.from(el.children).filter((c): c is HTMLElement => c.tagName === 'SPAN')
}

/** Display heading: lines rise and fade in, the small .dim line first. */
function playLines(el: HTMLElement, delay: number, done: () => void): gsap.core.Animation {
  const lines = lineSpans(el).sort((a, b) => Number(b.classList.contains('dim')) - Number(a.classList.contains('dim')))
  if (!lines.length) return playFade(el, delay, M.fade.dur, M.fade.rise, done)
  el.dataset.reveal = 'in' // the heading shows; its lines carry the start state from here
  return gsap.fromTo(
    lines,
    { yPercent: M.lines.rise, opacity: 0 },
    {
      yPercent: 0,
      opacity: 1,
      duration: M.lines.dur,
      ease: EASE,
      stagger: M.lines.stagger,
      delay,
      onComplete: () => {
        gsap.set(lines, { clearProps: 'transform,opacity' })
        done()
      },
    },
  )
}

function playFade(el: HTMLElement, delay: number, duration: number, rise: number, done: () => void): gsap.core.Animation {
  el.dataset.reveal = 'in'
  return gsap.fromTo(
    el,
    { y: rise, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration,
      ease: EASE,
      delay,
      onComplete: () => {
        gsap.set(el, { clearProps: 'transform,opacity' })
        done()
      },
    },
  )
}

/**
 * Caption type-in: a clip uncovers the text one character cell at a time while a block cursor walks
 * ahead of it, blinks, and goes. The text itself is never touched (screen readers read it whole).
 * Returns null when the caption doesn't qualify (too long, wraps, inline, or nothing to measure).
 */
function playType(el: HTMLElement, delay: number, done: () => void): gsap.core.Animation | null {
  if (getComputedStyle(el).display === 'inline') return null
  const box = el.getBoundingClientRect()
  const cells = charCells(el, box)
  if (!cells || cells.edges.length - 1 >= TYPE_MAX_CHARS) return null
  const { edges, top, height } = cells
  const n = edges.length - 1
  const cell = (edges[n] - edges[0]) / n
  const width = box.width

  const cursor = document.createElement('span')
  cursor.className = 'rv-cursor'
  cursor.setAttribute('aria-hidden', 'true')
  const state = { k: 0 }
  const apply = () => {
    const x = edges[Math.round(state.k)]
    el.style.clipPath = `inset(-0.25em ${Math.max(0, width - x - cell)}px -0.25em -2px)`
    cursor.style.transform = `translate(${x}px, ${top}px)`
  }

  return gsap
    .timeline({
      delay,
      onComplete: () => {
        cursor.remove()
        gsap.set(el, { clearProps: 'clipPath' })
        done()
      },
    })
    .call(() => {
      cursor.style.width = `${Math.max(2, cell * 0.86)}px`
      cursor.style.height = `${height}px`
      el.append(cursor)
      el.dataset.reveal = 'typing'
      apply()
    })
    .to(state, { k: n, duration: n * M.type.perChar, ease: `steps(${n})`, onUpdate: apply })
    .to(cursor, { opacity: 0, duration: M.type.blink, ease: 'steps(1)', repeat: M.type.blinks * 2 - 1, yoyo: true })
    .to(cursor, { opacity: 0, duration: M.type.blink, ease: 'steps(1)' })
}

/**
 * Left edge of the first character, then the right edge of each character, in px from the box's
 * left; plus the line box of the text. null if the text wraps or has nothing visible to measure.
 */
function charCells(el: HTMLElement, box: DOMRect): { edges: number[]; top: number; height: number } | null {
  const range = document.createRange()
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const edges: number[] = []
  let top = Infinity
  let bottom = -Infinity
  let firstTop: number | null = null
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const r = range.getBoundingClientRect()
      if (r.width === 0) continue // collapsed whitespace
      firstTop ??= r.top
      if (Math.abs(r.top - firstTop) > r.height / 2) return null // wraps onto a second line
      if (!edges.length) edges.push(r.left - box.left)
      edges.push(Math.max(r.right - box.left, edges[edges.length - 1]))
      top = Math.min(top, r.top - box.top)
      bottom = Math.max(bottom, r.bottom - box.top)
    }
  }
  if (edges.length < 2) return null
  return { edges, top, height: bottom - top }
}
