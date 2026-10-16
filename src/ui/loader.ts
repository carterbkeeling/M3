// Intro loader. The approved m³ mark (Slot) draws itself with its own loader choreography
// (wordmark.loader + LOADER_TIMING, via DrawSVG) in Pipe Cyan, the ink settles to bone, then the
// graphite field slides up and away (the cyan divider stroke riding its bottom edge) while the mark
// lands on the hero wordmark underneath. 1.2 s in all; once per session; any key (except Tab and
// bare modifiers), click, wheel or touch fast-forwards it. Reduced motion: the static mark for
// ~300 ms, then a 200 ms fade.
//
// It never blocks rendering: the page paints underneath, this is a fixed overlay that removes
// itself, and nothing here waits on fonts, the 3D stage or the network. While it covers the page,
// the skip link, header, main and footer are inert (back as soon as it opens). Call it first thing and
// don't await it before booting anything else:
//
//   import { runLoader } from './ui/loader.ts'
//   import { initReveals } from './ui/reveal.ts'
//   void runLoader({ reducedMotion })  // resolves once the overlay is gone (and removed)
//   initReveals({ reducedMotion })     // holds in-view reveals until the loader opens
//
// Signals for other modules: html[data-loader="running"] while it shows; window events
// 'm3:loader-open' (the field starts to move) and 'm3:loader-done' (the overlay is removed).
// Styles: src/styles/motion.css (.m3-loader*).

import { gsap } from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { LOADER_TIMING, wordmark, type LoaderStep, type WordmarkCandidate } from '../brand/wordmark.ts'
import { t } from '../content/copy.ts'

gsap.registerPlugin(DrawSVGPlugin, CustomEase)

export interface LoaderOptions {
  reducedMotion: boolean
  /** Play even if this session has already seen it, or the page has been up a while (dev harness). */
  force?: boolean
  /**
   * Element the mark lands on as the overlay opens (same mark, same color, same place, so the
   * hand-off is seamless). Default: the hero wordmark. null, or a target that is missing, hidden or
   * off screen: the mark rises and fades instead.
   */
  landOn?: string | null
}

/** The page's easing token (--ease in tokens.css): cubic-bezier(0.65, 0.05, 0, 1). */
const EASE = CustomEase.create('m3-ease', '0.65,0.05,0,1')

const SVGNS = 'http://www.w3.org/2000/svg'
const BONE = '#F3EFE7'
const SESSION_KEY = 'm3.loader'
const LAND_ON = '.hero__mark svg'
/** If the script only gets to run this late (slow network), the visitor is already reading the page: no intro. */
const LATE_MS = 2500
/** Keys that never skip: Tab reaches the skip button; bare modifiers are not an intent to skip. */
const PASSIVE_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'AltGraph'])
/** The page under the overlay: inert while it covers it, so Tab can't land on controls nobody can see. */
const BEHIND = 'body > .skip, body > header, main, body > footer'

/** Seconds. The full-motion run ends at openAt + open = 1.2 s. */
const TIMING = {
  drawAt: 0.04, // the pen starts
  draw: 0.72, // the whole choreography, scaled from LOADER_TIMING's pen-travel units
  inkAt: 0.58, // the ink starts to settle from Pipe Cyan to bone…
  ink: 0.3, // …and is bone by 0.88 s
  edgeAt: 0.62, // the divider stroke draws out along the field's bottom edge
  edge: 0.26,
  openAt: 0.84, // the field slides up and away; the mark lands on the hero wordmark
  open: 0.36,
  staticHold: 0.3, // reduced motion: the static mark…
  staticFade: 0.2, // …then a fade
  skipRest: 0.35, // a skip plays whatever is left within this long
  safety: 4, // wall-clock hard stop, even if the ticker stalls (hidden tab)
} as const

let active: Promise<void> | null = null
let playedThisPage = false

function alreadyPlayed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return playedThisPage // storage unavailable: play once per page load
  }
}

function markPlayed(): void {
  playedThisPage = true
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* storage unavailable (private mode, blocked): the in-page flag covers it */
  }
}

/**
 * Show the intro over the already-painted page. Resolves when the overlay is gone and removed from
 * the DOM; resolves at once when it doesn't play (already seen this session, tab hidden, or the
 * script ran late). Never rejects.
 */
export function runLoader(opts: LoaderOptions): Promise<void> {
  if (active) return active
  const { reducedMotion, force = false, landOn = LAND_ON } = opts
  if (!document.body) return Promise.resolve()
  if (!force && (alreadyPlayed() || document.visibilityState === 'hidden' || performance.now() > LATE_MS)) {
    return Promise.resolve()
  }
  markPlayed()
  active = new Promise<void>((resolve) => play(wordmark, reducedMotion, landOn, resolve)).finally(() => {
    active = null
  })
  return active
}

// ---- Playback ------------------------------------------------------------------------------------

type DevWindow = Window & { __m3LoaderFreeze?: boolean; __m3loader?: gsap.core.Timeline }

function play(mark: WordmarkCandidate, reduced: boolean, landOn: string | null, resolve: () => void): void {
  const html = document.documentElement
  let root: HTMLElement | null = null
  let tl: gsap.core.Timeline | null = null
  let draw: gsap.core.Timeline | null = null
  let safety = 0
  let opened = false
  let finished = false
  let skipping = false
  let inert: Element[] = []

  // The page comes back as the field opens (and on every way out: the end, a skip, the safety stop,
  // an error). Only what this made inert is restored.
  const release = () => {
    inert.forEach((el) => el.removeAttribute('inert'))
    inert = []
  }

  const open = () => {
    if (opened) return
    opened = true
    release()
    if (root) root.dataset.state = 'open'
    window.dispatchEvent(new Event('m3:loader-open'))
  }

  const finish = () => {
    if (finished) return
    finished = true
    release()
    window.clearTimeout(safety)
    tl?.kill()
    draw?.kill()
    removeEventListener('keydown', onKey, true)
    removeEventListener('pointerdown', skip, true)
    removeEventListener('wheel', skip, true)
    removeEventListener('touchstart', skip, true)
    open()
    root?.remove()
    delete html.dataset.loader
    window.dispatchEvent(new Event('m3:loader-done'))
    resolve()
  }

  // Fast-forward whatever is left so it ends within skipRest (the mark completes, then opens).
  function skip() {
    if (finished || skipping || !tl) return
    skipping = true
    if (tl.paused()) return finish()
    const left = tl.duration() - tl.time()
    tl.timeScale(Math.max(1, left / TIMING.skipRest))
  }
  function onKey(e: KeyboardEvent) {
    if (!PASSIVE_KEYS.has(e.key)) skip()
  }

  try {
    // ---- DOM: field (with the divider edge), mark, skip control ----
    root = document.createElement('div')
    root.className = reduced ? 'm3-loader m3-loader--static' : 'm3-loader'
    root.setAttribute('role', 'status')
    root.setAttribute('aria-label', t('loader.label'))

    const field = document.createElement('div')
    field.className = 'm3-loader__field'
    const edge = document.createElement('span')
    edge.className = 'm3-loader__edge'
    field.append(edge)

    const { svg, paths } = markSvg(mark, reduced)

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'm3-loader__skip'
    button.textContent = t('loader.skip')
    button.addEventListener('click', skip)

    root.append(field, svg, button)
    document.body.prepend(root)
    html.dataset.loader = 'running'
    inert = Array.from(document.querySelectorAll(BEHIND)).filter((el) => !el.hasAttribute('inert'))
    inert.forEach((el) => el.setAttribute('inert', ''))

    addEventListener('keydown', onKey, true)
    addEventListener('pointerdown', skip, true)
    addEventListener('wheel', skip, { capture: true, passive: true })
    addEventListener('touchstart', skip, { capture: true, passive: true })

    // ---- Timeline ----
    tl = gsap.timeline({ onComplete: finish })
    if (reduced) {
      tl.addLabel('open', TIMING.staticHold)
        .call(open, [], 'open')
        .to(root, { opacity: 0, duration: TIMING.staticFade, ease: 'none' }, 'open')
    } else {
      draw = drawTimeline(mark, paths)
      // One gentle ease over the whole pen run: it sets off and comes to rest like a hand.
      tl.add(draw.tweenFromTo(0, draw.duration(), { duration: TIMING.draw, ease: 'power1.inOut' }), TIMING.drawAt)
      tl.to(svg, { color: BONE, duration: TIMING.ink, ease: 'power1.inOut' }, TIMING.inkAt)
      tl.to(edge, { scaleX: 1, duration: TIMING.edge, ease: EASE }, TIMING.edgeAt)

      // Where the mark lands, measured once when the opening starts (fonts and layout have settled).
      let landing: { x: number; y: number; s: number; ok: boolean } | null = null
      const land = () => (landing ??= measureLanding(svg, landOn))
      gsap.set(svg, { transformOrigin: '0 0' })
      tl.addLabel('open', TIMING.openAt)
        .call(open, [], 'open')
        .to(field, { yPercent: -100, duration: TIMING.open, ease: EASE }, 'open')
        .to(svg, { x: () => land().x, y: () => land().y, scale: () => land().s, duration: TIMING.open, ease: EASE }, 'open')
        // Landed: crossfade onto the real wordmark over the last 30 %. Not landing: fade on the way up.
        .to(svg, { opacity: 0, duration: TIMING.open, ease: (p: number) => (land().ok ? clamp01((p - 0.7) / 0.3) : clamp01(p * 1.6)) }, 'open')
    }

    if (import.meta.env.DEV) {
      // Capture hook (tests/capture/motion.spec.ts): freeze at 0 and seek frames deterministically.
      const w = window as DevWindow
      w.__m3loader = tl
      if (w.__m3LoaderFreeze) {
        tl.pause(0)
        return
      }
    }
    safety = window.setTimeout(finish, TIMING.safety * 1000)
  } catch (err) {
    // A loader must never stand between the visitor and the page.
    if (import.meta.env.DEV) console.warn('[loader] skipped:', err)
    finish()
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** The overlay mark: one <g> holding a path per draw step (or the resting paths when static). */
function markSvg(mark: WordmarkCandidate, reduced: boolean): { svg: SVGSVGElement; paths: SVGPathElement[] } {
  const [, , vw, vh] = mark.viewBox.trim().split(/[\s,]+/).map(Number)
  const svg = document.createElementNS(SVGNS, 'svg')
  svg.setAttribute('class', 'm3-loader__mark')
  svg.setAttribute('viewBox', mark.viewBox)
  svg.setAttribute('width', String(vw))
  svg.setAttribute('height', String(vh))
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const g = document.createElementNS(SVGNS, 'g')
  g.setAttribute('fill', 'none')
  g.setAttribute('stroke', 'currentColor')
  g.setAttribute('stroke-width', String(mark.strokeWidth))
  g.setAttribute('stroke-linecap', 'round')
  g.setAttribute('stroke-linejoin', 'round')
  const ds = reduced ? mark.paths : mark.loader.filter((s) => (s.mode ?? 'draw') === 'draw').map((s) => s.d)
  const paths = ds.map((d) => {
    const p = document.createElementNS(SVGNS, 'path')
    p.setAttribute('d', d)
    g.append(p)
    return p
  })
  svg.append(g)
  return { svg, paths }
}

/** Translate/scale that puts the overlay mark exactly over the landing target (transform-origin 0 0). */
function measureLanding(svg: SVGSVGElement, landOn: string | null): { x: number; y: number; s: number; ok: boolean } {
  const fallback = { x: 0, y: -32, s: 1, ok: false }
  const target = landOn ? document.querySelector(landOn) : null
  if (!target) return fallback
  const r = target.getBoundingClientRect()
  const m = svg.getBoundingClientRect()
  const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
  if (!onScreen || m.height <= 0 || getComputedStyle(target).visibility === 'hidden') return fallback
  return { x: r.left - m.left, y: r.top - m.top, s: r.height / m.height, ok: true }
}

// ---- Pen choreography (the LOADER_TIMING model; the specimen in src/wordmarks.ts is the reference) ----

type Pt = { x: number; y: number }
/** A line (with its unit direction) or a circular arc. */
type Seg = { len: number; line: boolean; dx: number; dy: number }
type Piece = { len: number; weight: number }
interface Planned {
  mode: 'draw' | 'retract'
  len: number
  pieces: Piece[]
  dur: number
  start: number
  end: number
  endPt: Pt
  /** Draw steps: index into the draw paths. Retract steps: the draw step they remove. */
  path: number
  retracted: boolean
}

/** Centerline segments of a mark path (the mark's grammar: absolute M / L / H / V / circular A). */
function parse(d: string): { segs: Seg[]; start: Pt; end: Pt } {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const segs: Seg[] = []
  let i = 0
  let cmd = ''
  let p: Pt = { x: 0, y: 0 }
  let start: Pt | null = null
  const num = () => Number(tok[i++])
  const lineTo = (q: Pt) => {
    const dx = q.x - p.x
    const dy = q.y - p.y
    const len = Math.hypot(dx, dy)
    if (len > 0) segs.push({ len, line: true, dx: dx / len, dy: dy / len })
    p = q
  }
  while (i < tok.length) {
    if (/^[a-zA-Z]$/.test(tok[i] as string)) cmd = tok[i++] as string
    switch (cmd) {
      case 'M':
        p = { x: num(), y: num() }
        start ??= p
        cmd = 'L' // further pairs are implicit linetos
        break
      case 'L':
        lineTo({ x: num(), y: num() })
        break
      case 'H':
        lineTo({ x: num(), y: p.y })
        break
      case 'V':
        lineTo({ x: p.x, y: num() })
        break
      case 'A': {
        const rx = num()
        i += 2 // ry (= rx: the mark only has circular arcs), x-axis rotation
        const large = num()
        i += 1 // sweep
        const q = { x: num(), y: num() }
        const chord = Math.hypot(q.x - p.x, q.y - p.y)
        const r = Math.max(rx, chord / 2)
        let theta = 2 * Math.asin(Math.min(1, chord / (2 * r)))
        if (large) theta = 2 * Math.PI - theta
        if (chord > 0) segs.push({ len: r * theta, line: false, dx: 0, dy: 0 })
        p = q
        break
      }
      default:
        throw new Error(`loader: unsupported path command "${cmd}" in ${d}`)
    }
  }
  if (!start) throw new Error(`loader: empty path ${d}`)
  return { segs, start, end: p }
}

/** Timed pieces of a drawn stroke: a line that runs straight back over the previous one is a retrace (fast). */
function drawPieces(segs: Seg[]): Piece[] {
  const out: Piece[] = []
  const push = (len: number, weight: number) => {
    const last = out[out.length - 1]
    if (last && last.weight === weight) last.len += len
    else out.push({ len, weight })
  }
  segs.forEach((s, k) => {
    const prev = segs[k - 1]
    if (prev && prev.line && s.line && prev.dx * s.dx + prev.dy * s.dy < -1 + 1e-9) {
      const back = Math.min(s.len, prev.len)
      push(back, LOADER_TIMING.retraceWeight)
      if (s.len > back) push(s.len - back, 1)
    } else {
      push(s.len, 1)
    }
  })
  return out
}

/** Schedule the steps in pen-travel units, exactly as the wordmark specimen does. */
function planSteps(steps: readonly LoaderStep[], strokeWidth: number): Planned[] {
  const out: Planned[] = []
  let drawIndex = 0
  steps.forEach((step, k) => {
    const mode = step.mode ?? 'draw'
    const { segs, start: startPt, end: endPt } = parse(step.d)
    const len = segs.reduce((a, s) => a + s.len, 0)
    const pieces = mode === 'retract' ? [{ len, weight: LOADER_TIMING.retractWeight }] : drawPieces(segs)
    const dur = pieces.reduce((a, p) => a + p.len * p.weight, 0)

    let path = -1
    if (mode === 'draw') {
      path = drawIndex++
    } else {
      for (let j = k - 1; j >= 0; j--) {
        const s = out[j] as Planned
        if (s.mode === 'draw' && !s.retracted && (steps[j] as LoaderStep).d.trim() === step.d.trim()) {
          s.retracted = true
          path = s.path
          break
        }
      }
      if (path < 0) throw new Error(`loader: step "${step.label}" retracts a stroke that was never drawn`)
    }

    let start = 0
    const prev = out[k - 1]
    if (prev && step.withPrevious) {
      start = prev.start
    } else if (prev) {
      // After everything so far. A stroke that picks up within one stroke width of where the pen
      // stopped starts as the pen passes it; after a pen lift the next stroke leads by liftLead.
      const latest = out.reduce((a, s) => (s.end > a.end ? s : a))
      const gap = Math.hypot(latest.endPt.x - startPt.x, latest.endPt.y - startPt.y)
      const lead = mode === 'retract' ? 0 : gap <= strokeWidth ? gap : LOADER_TIMING.liftLead
      start = Math.max(0, latest.end - lead)
    }
    out.push({ mode, len, pieces, dur, start, end: start + dur, endPt, path, retracted: false })
  })
  return out
}

/** A paused timeline in pen-travel units (1 unit = 1 s); the caller scales and eases it. */
function drawTimeline(mark: WordmarkCandidate, paths: SVGPathElement[]): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true })
  // Hidden until its pen starts: a zero-length dash with round caps would show as a dot.
  gsap.set(paths, { drawSVG: '0% 0%', opacity: 0 })
  for (const step of planSteps(mark.loader, mark.strokeWidth)) {
    const el = paths[step.path] as SVGPathElement
    if (step.mode === 'retract') {
      tl.fromTo(el, { drawSVG: '0% 100%' }, { drawSVG: '100% 100%', duration: step.dur, ease: 'none', immediateRender: false }, step.start)
      tl.set(el, { opacity: 0 }, step.end)
      continue
    }
    tl.set(el, { opacity: 1 }, step.start)
    let at = step.start
    let acc = 0
    for (const piece of step.pieces) {
      const from = (acc / step.len) * 100
      const to = ((acc + piece.len) / step.len) * 100
      const dur = piece.len * piece.weight
      tl.fromTo(el, { drawSVG: `0% ${from}%` }, { drawSVG: `0% ${to}%`, duration: dur, ease: 'none', immediateRender: false }, at)
      acc += piece.len
      at += dur
    }
  }
  return tl
}
