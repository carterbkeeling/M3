// Dev-only specimen page for the m³ wordmark candidates (wordmarks.html; not a build input).
// Renders every candidate at 320 / 96 / 32 / 16 px on both tones and in Pipe Cyan, the loader's
// draw-on sequence (frames at 0 / 25 / 50 / 75 / 100 % of its timeline, plus the timeline itself),
// a construction overlay, a side-by-side with a schematic of the Muni worm, 16 px pixel loupes and a
// nav mock. It also checks the geometry (exact radii, tangent-continuous joins, tight viewBox,
// whole-pixel width at 16 px, m-to-³ gap) and the loader (pen lifts match `singleStroke`, the
// loader's end state rasterises identically to the resting mark) and exposes the result as
// window.__wordmarkReport for tests/capture/wordmarks.spec.ts.

import { wordmarks, viewBoxOf, wordmarkSvg, WORDMARK_LABEL, LOADER_TIMING } from './brand/wordmark.ts'
import type { WordmarkCandidate, LoaderStep } from './brand/wordmark.ts'

const GRAPHITE = '#15161A'
const BONE = '#F3EFE7'
const CYAN = '#12D6FF'
const CYAN_DEEP = '#0A7C94'
const G60 = '#7F8187'
const HAIRLINE = '#2A2C31'
const SVGNS = 'http://www.w3.org/2000/svg'
const TAU = Math.PI * 2
/** Loader length the Phase 3 loader targets; used only to print milliseconds on the timeline. */
const LOADER_MS = 1200
// The Muni-worm schematic is a local resemblance check only: shown with ?muni=1, never in committed captures.
const SHOW_MUNI = new URLSearchParams(location.search).get('muni') === '1'

type Mark = Pick<WordmarkCandidate, 'viewBox' | 'strokeWidth' | 'paths'>

// ---------------------------------------------------------------------------------------------
// Geometry: parse the centerline (absolute M/L/H/V/A only) and check it.
// ---------------------------------------------------------------------------------------------

type Pt = { x: number; y: number }
type Line = { kind: 'line'; p0: Pt; p1: Pt; len: number }
type Arc = { kind: 'arc'; p0: Pt; p1: Pt; r: number; sweep: boolean; c: Pt; a0: number; da: number; len: number }
type Seg = Line | Arc
type Box = { x0: number; y0: number; x1: number; y1: number }

interface PathReport {
  segments: number
  length: number
  radii: Record<string, number>
  reversals: Pt[]
  kinks: { at: Pt; angle: number }[]
  errors: string[]
  centerline: Box
  stroke: Box
  start: Pt
  end: Pt
}

interface LoaderReport {
  /** Timeline length in pen-travel units. */
  total: number
  /** Start points of strokes that begin away from any ink on screen (pen lifts). */
  lifts: Pt[]
  steps: { label: string; mode: string; start: number; end: number }[]
  /** Pixels whose alpha differs by > 64 between the loader's end state and the resting mark (160 px tall). */
  restDiff: number
  /** Every loader stroke (temporary ones included) stays inside the viewBox. */
  withinViewBox: boolean
}

export interface CandidateReport {
  id: string
  name: string
  singleStroke: boolean
  paths: PathReport[]
  kinks: number
  errors: string[]
  stroke: Box
  viewBoxMatches: boolean
  sup: { top: number; bottom: number; ratio: number } | null
  /** Width in px when the m is 16 px tall (whole number = the nav stays on the pixel grid). */
  widthAt16: number
  /** Smallest ink-to-ink distance between the m and the ³, in viewBox units. */
  gap: number
  loader: LoaderReport
}

declare global {
  interface Window {
    __wordmarkReport?: CandidateReport[]
  }
}

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
const mod = (a: number) => ((a % TAU) + TAU) % TAU
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const fmt = (n: number) => String(+n.toFixed(2))
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function arcFrom(p0: Pt, p1: Pt, r: number, large: boolean, sweep: boolean): Arc {
  // SVG arc endpoint → center parameterisation (F.6.5) for a circle (rx = ry = r, no rotation).
  const x1p = (p0.x - p1.x) / 2
  const y1p = (p0.y - p1.y) / 2
  const d2 = x1p * x1p + y1p * y1p
  if (d2 > r * r * (1 + 1e-9)) {
    throw new Error(`arc R${r} from (${p0.x},${p0.y}) to (${p1.x},${p1.y}) is too small for its chord`)
  }
  let coef = Math.sqrt(Math.max(0, (r * r - d2) / d2))
  if (large === sweep) coef = -coef
  const c = { x: coef * y1p + (p0.x + p1.x) / 2, y: -coef * x1p + (p0.y + p1.y) / 2 }
  const a0 = Math.atan2(p0.y - c.y, p0.x - c.x)
  const a1 = Math.atan2(p1.y - c.y, p1.x - c.x)
  let da = a1 - a0
  if (sweep) while (da <= 1e-12) da += TAU
  else while (da >= -1e-12) da -= TAU
  return { kind: 'arc', p0, p1, r, sweep, c, a0, da, len: r * Math.abs(da) }
}

function parsePath(d: string): Seg[] {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const segs: Seg[] = []
  let i = 0
  let cmd = ''
  let cur: Pt | null = null
  const isCmd = (t: string) => /^[A-Za-z]$/.test(t)
  const num = (): number => {
    const t = tokens[i++]
    if (t === undefined || isCmd(t)) throw new Error(`expected a number at token ${i - 1} in "${d}"`)
    return Number(t)
  }
  while (i < tokens.length) {
    const t = tokens[i] as string
    if (isCmd(t)) {
      cmd = t
      i++
    }
    if (!cmd) throw new Error('a path must start with M')
    if (cmd !== cmd.toUpperCase()) throw new Error(`relative command "${cmd}": use absolute commands only`)
    if (cmd === 'M') {
      if (cur) throw new Error('more than one subpath (M) in one path string')
      cur = { x: num(), y: num() }
      cmd = 'L'
      continue
    }
    if (!cur) throw new Error('a path must start with M')
    let seg: Seg
    if (cmd === 'A') {
      const rx = num()
      const ry = num()
      const rot = num()
      const large = num() === 1
      const sweep = num() === 1
      const p1 = { x: num(), y: num() }
      if (rx !== ry || rot !== 0) throw new Error(`arc must be circular and unrotated (got ${rx} ${ry} ${rot})`)
      seg = arcFrom(cur, p1, rx, large, sweep)
    } else {
      let p1: Pt
      if (cmd === 'L') p1 = { x: num(), y: num() }
      else if (cmd === 'H') p1 = { x: num(), y: cur.y }
      else if (cmd === 'V') p1 = { x: cur.x, y: num() }
      else throw new Error(`unsupported command "${cmd}"`)
      seg = { kind: 'line', p0: cur, p1, len: Math.hypot(p1.x - cur.x, p1.y - cur.y) }
    }
    if (seg.len < 1e-9) throw new Error(`zero-length segment at (${cur.x},${cur.y})`)
    segs.push(seg)
    cur = seg.p1
  }
  if (!segs.length) throw new Error('empty path')
  return segs
}

function unit(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y)
  return { x: v.x / l, y: v.y / l }
}

function tangentAt(s: Seg, end: boolean): Pt {
  if (s.kind === 'line') return unit({ x: s.p1.x - s.p0.x, y: s.p1.y - s.p0.y })
  const p = end ? s.p1 : s.p0
  const v = { x: p.x - s.c.x, y: p.y - s.c.y }
  // y-down: sweep = 1 is clockwise on screen, i.e. the radius vector rotated by +90°.
  return unit(s.sweep ? { x: -v.y, y: v.x } : { x: v.y, y: -v.x })
}

const tangentDot = (a: Seg, b: Seg) => {
  const ta = tangentAt(a, true)
  const tb = tangentAt(b, false)
  return clamp(ta.x * tb.x + ta.y * tb.y, -1, 1)
}

function centerlineBox(segs: Seg[]): Box {
  const pts: Pt[] = []
  for (const s of segs) {
    pts.push(s.p0, s.p1)
    if (s.kind === 'arc') {
      for (const th of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const off = s.da > 0 ? mod(th - s.a0) : mod(s.a0 - th)
        if (off <= Math.abs(s.da) + 1e-9) pts.push({ x: s.c.x + s.r * Math.cos(th), y: s.c.y + s.r * Math.sin(th) })
      }
    }
  }
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  }
}

const grow = (b: Box, r: number): Box => ({ x0: b.x0 - r, y0: b.y0 - r, x1: b.x1 + r, y1: b.y1 + r })
const union = (a: Box, b: Box): Box => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
})

function pathLength(segs: Seg[]): number {
  return segs.reduce((a, s) => a + s.len, 0)
}

function pointAt(segs: Seg[], s: number): Pt {
  let left = s
  for (const seg of segs) {
    if (left <= seg.len || seg === segs[segs.length - 1]) {
      const t = clamp(left / seg.len, 0, 1)
      if (seg.kind === 'line') return { x: seg.p0.x + (seg.p1.x - seg.p0.x) * t, y: seg.p0.y + (seg.p1.y - seg.p0.y) * t }
      const a = seg.a0 + seg.da * t
      return { x: seg.c.x + seg.r * Math.cos(a), y: seg.c.y + seg.r * Math.sin(a) }
    }
    left -= seg.len
  }
  return { x: 0, y: 0 }
}

/** Points along [from, to] of a centerline, every `step` units, both ends included. */
function sample(segs: Seg[], from = 0, to = pathLength(segs), step = 0.5): Pt[] {
  const out: Pt[] = []
  for (let s = from; s < to; s += step) out.push(pointAt(segs, s))
  out.push(pointAt(segs, to))
  return out
}

function analysePath(d: string, w: number): { segs: Seg[]; report: PathReport } {
  const errors: string[] = []
  let segs: Seg[] = []
  try {
    segs = parsePath(d)
  } catch (e) {
    errors.push(errText(e))
  }
  const radii: Record<string, number> = {}
  const reversals: Pt[] = []
  const kinks: { at: Pt; angle: number }[] = []
  for (const [k, s] of segs.entries()) {
    if (s.kind === 'arc') radii[`R${fmt(s.r)}`] = (radii[`R${fmt(s.r)}`] ?? 0) + 1
    if (k === 0) continue
    const dot = tangentDot(segs[k - 1] as Seg, s)
    if (dot > 1 - 1e-9) continue
    if (dot < -1 + 1e-9) reversals.push(s.p0)
    else kinks.push({ at: s.p0, angle: (Math.acos(dot) * 180) / Math.PI })
  }
  const centerline = segs.length ? centerlineBox(segs) : { x0: 0, y0: 0, x1: 0, y1: 0 }
  const first = segs[0]
  const last = segs[segs.length - 1]
  return {
    segs,
    report: {
      segments: segs.length,
      length: pathLength(segs),
      radii,
      reversals,
      kinks,
      errors,
      centerline,
      stroke: grow(centerline, w / 2),
      start: first ? first.p0 : { x: 0, y: 0 },
      end: last ? last.p1 : { x: 0, y: 0 },
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Loader timeline (the LOADER_TIMING model from src/brand/wordmark.ts)
// ---------------------------------------------------------------------------------------------

interface Piece {
  len: number
  weight: number
}

interface StepPlan {
  step: LoaderStep
  mode: 'draw' | 'retract'
  segs: Seg[]
  len: number
  pieces: Piece[]
  dur: number
  start: number
  end: number
  /** Draw steps: index of the step that retracts this stroke. */
  retractedBy: number | null
  /** Retract steps: index of the draw step they remove. */
  target: number | null
}

interface LoaderPlan {
  steps: StepPlan[]
  total: number
  lifts: Pt[]
  errors: string[]
  bounds: Box
}

/** Time pieces of a drawn stroke: a line that runs straight back over the previous line is a retrace. */
function drawPieces(segs: Seg[]): Piece[] {
  const out: Piece[] = []
  const push = (len: number, weight: number) => {
    const last = out[out.length - 1]
    if (last && last.weight === weight) last.len += len
    else out.push({ len, weight })
  }
  segs.forEach((s, k) => {
    const prev = k ? (segs[k - 1] as Seg) : null
    if (prev && prev.kind === 'line' && s.kind === 'line' && tangentDot(prev, s) < -1 + 1e-9) {
      const back = Math.min(s.len, prev.len)
      push(back, LOADER_TIMING.retraceWeight)
      if (s.len > back) push(s.len - back, 1)
    } else {
      push(s.len, 1)
    }
  })
  return out
}

/** Stroke length reached after local time τ. */
function lengthAt(p: StepPlan, tau: number): number {
  if (tau >= p.dur) return p.len
  let left = Math.max(0, tau)
  let acc = 0
  for (const piece of p.pieces) {
    const t = piece.len * piece.weight
    if (left <= t) return acc + left / piece.weight
    left -= t
    acc += piece.len
  }
  return p.len
}

/** Visible window [from, to] (in length units) of draw step k at time t. */
function windowAt(plan: LoaderPlan, k: number, t: number): [number, number] {
  const s = plan.steps[k] as StepPlan
  const to = t <= s.start ? 0 : lengthAt(s, t - s.start)
  let from = 0
  if (s.retractedBy !== null) {
    const r = plan.steps[s.retractedBy] as StepPlan
    from = t <= r.start ? 0 : lengthAt(r, t - r.start)
  }
  return [from, Math.max(from, to)]
}

function planLoader(c: WordmarkCandidate): LoaderPlan {
  const w = c.strokeWidth
  const errors: string[] = []
  const steps: StepPlan[] = []
  if (!c.loader.length) errors.push('loader has no steps')
  for (const [k, step] of c.loader.entries()) {
    let segs: Seg[]
    try {
      segs = parsePath(step.d)
    } catch (e) {
      errors.push(`loader step ${k + 1} (${step.label}): ${errText(e)}`)
      return { steps: [], total: 0, lifts: [], errors, bounds: { x0: 0, y0: 0, x1: 0, y1: 0 } }
    }
    const mode = step.mode ?? 'draw'
    const len = pathLength(segs)
    const pieces = mode === 'retract' ? [{ len, weight: LOADER_TIMING.retractWeight }] : drawPieces(segs)
    const dur = pieces.reduce((a, p) => a + p.len * p.weight, 0)
    let target: number | null = null
    if (mode === 'retract') {
      for (let j = k - 1; j >= 0; j--) {
        const s = steps[j] as StepPlan
        if (s.mode === 'draw' && s.retractedBy === null && s.step.d.trim() === step.d.trim()) {
          target = j
          break
        }
      }
      if (target === null) errors.push(`loader step ${k + 1} (${step.label}) retracts a stroke that was never drawn`)
      else (steps[target] as StepPlan).retractedBy = k
    }
    let start = 0
    const prev = steps[k - 1]
    if (prev && step.withPrevious) {
      start = prev.start
    } else if (prev) {
      // After everything so far. A stroke that picks up within one stroke width of where the last
      // pen stopped (the worm's link) starts exactly when that pen passes its start point; after a
      // pen lift the next stroke leads by liftLead so the lift reads as one gesture.
      const latest = steps.reduce((a, s) => (s.end > a.end ? s : a))
      const lastSeg = latest.segs[latest.segs.length - 1] as Seg
      const gap = dist(lastSeg.p1, (segs[0] as Seg).p0)
      const lead = mode === 'retract' ? 0 : gap <= w ? gap : LOADER_TIMING.liftLead
      start = Math.max(0, latest.end - lead)
    }
    steps.push({ step, mode, segs, len, pieces, dur, start, end: start + dur, retractedBy: null, target })
  }
  const total = Math.max(0, ...steps.map((s) => s.end))
  const plan: LoaderPlan = { steps, total, lifts: [], errors, bounds: { x0: 0, y0: 0, x1: 0, y1: 0 } }
  if (!steps.length) return plan
  plan.bounds = steps.map((s) => grow(centerlineBox(s.segs), w / 2)).reduce(union)

  // Pen lifts: a draw step whose start point is not on ink already on screen when it starts.
  for (const [k, s] of steps.entries()) {
    if (k === 0 || s.mode !== 'draw') continue
    const p = (s.segs[0] as Seg).p0
    let onInk = false
    for (const [j, o] of steps.entries()) {
      if (j === k || o.mode !== 'draw' || onInk) continue
      const [from, to] = windowAt(plan, j, s.start)
      if (to - from <= 1e-6) continue
      onInk = sample(o.segs, from, to).some((q) => dist(q, p) <= w / 2 + 1e-3)
    }
    if (!onInk) plan.lifts.push(p)
  }
  return plan
}

/** The strokes left on screen when the loader ends. */
function restPathsOf(plan: LoaderPlan): string[] {
  return plan.steps.filter((s) => s.mode === 'draw' && s.retractedBy === null).map((s) => s.step.d)
}

// ---------------------------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------------------------

interface Analysis {
  segs: Seg[][]
  plan: LoaderPlan
  report: CandidateReport
}

async function alphaOf(m: Mark, height: number): Promise<Uint8ClampedArray> {
  const [, , vw, vh] = viewBoxOf(m)
  const width = Math.round((height * vw) / vh)
  const canvas = htmlEl('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2D canvas')
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wordmarkSvg(m, { color: '#000', height }))}`
  await img.decode()
  ctx.drawImage(img, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height).data
}

async function analyse(c: WordmarkCandidate): Promise<Analysis> {
  const w = c.strokeWidth
  const parts = c.paths.map((d) => analysePath(d, w))
  const reports = parts.map((p) => p.report)
  const stroke = reports.map((r) => r.stroke).reduce(union)
  const [vx, vy, vw, vh] = viewBoxOf(c)
  const viewBoxMatches =
    near(stroke.x0, vx) && near(stroke.y0, vy) && near(stroke.x1, vx + vw) && near(stroke.y1, vy + vh)
  const errors = reports.flatMap((r) => r.errors)
  if (!viewBoxMatches) {
    errors.push(`viewBox ${c.viewBox} ≠ stroke bounds ${fmt(stroke.x0)} ${fmt(stroke.y0)} ${fmt(stroke.x1 - stroke.x0)} ${fmt(stroke.y1 - stroke.y0)}`)
  }
  const widthAt16 = (vw * 16) / vh
  if (!near(widthAt16, Math.round(widthAt16), 1e-9)) errors.push(`${fmt(widthAt16)} px wide at 16 px: not a whole number of pixels`)

  // The superscript is the last path (every resting mark draws the m first, then the ³).
  let sup: CandidateReport['sup'] = null
  const lastSegs = parts[parts.length - 1]?.segs ?? []
  if (lastSegs.length) {
    const b = grow(centerlineBox(lastSegs), w / 2)
    sup = { top: b.y0 - vy, bottom: b.y1 - vy, ratio: (b.y1 - b.y0) / vh }
  }

  // m-to-³ gap: the ³ is the last path, the m is everything before it.
  const mPts = parts.slice(0, -1).flatMap((p) => (p.segs.length ? sample(p.segs) : []))
  const supPts = lastSegs.length ? sample(lastSegs) : []
  let gap = Infinity
  for (const a of mPts) for (const b of supPts) gap = Math.min(gap, dist(a, b))
  gap -= w

  // Loader: timeline, pen lifts vs the singleStroke flag, bounds, end state = resting mark.
  const plan = planLoader(c)
  errors.push(...plan.errors)
  const singleStrokeActual = plan.lifts.length === 0
  if (c.singleStroke !== singleStrokeActual) {
    errors.push(`singleStroke is ${c.singleStroke} but the loader ${singleStrokeActual ? 'never lifts the pen' : `lifts the pen ${plan.lifts.length}×`}`)
  }
  const withinViewBox =
    plan.bounds.x0 >= vx - 1e-6 && plan.bounds.y0 >= vy - 1e-6 && plan.bounds.x1 <= vx + vw + 1e-6 && plan.bounds.y1 <= vy + vh + 1e-6
  if (!withinViewBox) errors.push('a loader stroke leaves the viewBox')
  let restDiff = -1
  if (plan.steps.length) {
    const [a, b] = await Promise.all([alphaOf(c, 160), alphaOf({ ...c, paths: restPathsOf(plan) }, 160)])
    restDiff = 0
    for (let i = 3; i < a.length; i += 4) if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > 64) restDiff++
    if (restDiff > 0) errors.push(`the loader's end state differs from the resting mark in ${restDiff} px`)
  }

  return {
    segs: parts.map((p) => p.segs),
    plan,
    report: {
      id: c.id,
      name: c.name,
      singleStroke: c.singleStroke,
      paths: reports,
      kinks: reports.reduce((a, r) => a + r.kinks.length, 0),
      errors,
      stroke,
      viewBoxMatches,
      sup,
      widthAt16,
      gap,
      loader: {
        total: plan.total,
        lifts: plan.lifts,
        steps: plan.steps.map((s) => ({ label: s.step.label, mode: s.mode, start: s.start, end: s.end })),
        restDiff,
        withinViewBox,
      },
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Comparison and study marks (specimen only)
// ---------------------------------------------------------------------------------------------

/**
 * A SCHEMATIC of the Muni worm's construction, built from its traits only (one uniform heavy
 * stroke, tight round arches and cups, m-u-n linked so the m's last stem turns straight into the u
 * on the baseline, a dotted i). It is not the logo: the real mark stays out of the repo.
 */
const MUNI = {
  viewBox: '0 -30 158 110',
  strokeWidth: 16,
  xHeight: 80,
  paths: [
    'M8 72 V22 A14 14 0 0 1 36 22 V72 V22 A14 14 0 0 1 64 22 V58 A14 14 0 0 0 92 58 V22 A14 14 0 0 1 120 22 V72',
    'M150 72 V8',
  ],
  dot: { cx: 150, cy: -20, r: 10 },
}

/** Critique S3: a squarer ³ for Slot, 60 units tall with 5-unit flats on the right (counters 15). */
const SLOT_S3_SUP =
  'M110 5 H120 A10 10 0 0 1 130 15 V20 A10 10 0 0 1 120 30 H115 H125 A10 10 0 0 1 135 40 V45 A10 10 0 0 1 125 55 H110'

function slotS3(slot: WordmarkCandidate): WordmarkCandidate {
  const paths = [...slot.paths.slice(0, -1), SLOT_S3_SUP]
  return {
    ...slot,
    id: 'slot-s3',
    name: 'Slot with the S3 squared ³',
    paths,
    singleStroke: false,
    loader: paths.map((d, k) => ({ label: `path ${k + 1}`, d })),
  }
}

// ---------------------------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------------------------

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}

function htmlEl<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text) e.textContent = text
  return e
}

function strokeGroup(color: string, w: number): SVGGElement {
  return svgEl('g', {
    fill: 'none',
    stroke: color,
    'stroke-width': w,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })
}

function blankSvg(m: Pick<Mark, 'viewBox'>, height: number, label = WORDMARK_LABEL): SVGSVGElement {
  const [, , vw, vh] = viewBoxOf(m)
  return svgEl('svg', {
    viewBox: m.viewBox,
    width: +((height * vw) / vh).toFixed(3),
    height,
    role: 'img',
    'aria-label': label,
  })
}

function markSvg(m: Mark, color: string, height: number): SVGSVGElement {
  const svg = blankSvg(m, height)
  const g = strokeGroup(color, m.strokeWidth)
  for (const d of m.paths) g.append(svgEl('path', { d }))
  svg.append(g)
  return svg
}

/** The Muni schematic with its x-height at `xHeight` px (the dot rises above it). */
function muniSvg(color: string, xHeight: number): SVGSVGElement {
  const [, , vw, vh] = viewBoxOf(MUNI)
  const k = xHeight / MUNI.xHeight
  const svg = svgEl('svg', {
    viewBox: MUNI.viewBox,
    width: +(vw * k).toFixed(3),
    height: +(vh * k).toFixed(3),
    role: 'img',
    'aria-label': 'Muni worm, schematic',
  })
  const g = strokeGroup(color, MUNI.strokeWidth)
  for (const d of MUNI.paths) g.append(svgEl('path', { d }))
  svg.append(g, svgEl('circle', { ...MUNI.dot, fill: color }))
  return svg
}

function labelled(node: Element, label: string): HTMLElement {
  const box = htmlEl('div', 'size')
  box.append(node, htmlEl('span', 'label', label))
  return box
}

function sized(m: Mark, color: string, height: number, label = `${height} px`): HTMLElement {
  return labelled(markSvg(m, color, height), label)
}

/**
 * One loader frame at time t: each draw step's visible window as a dash, optionally over a ghost
 * of the resting mark and with rings at the pen tips (dashed ring = a retracting tail).
 */
function frameSvg(
  c: WordmarkCandidate,
  a: Analysis,
  t: number,
  height: number,
  opts: { color?: string; ghost?: boolean; tips?: boolean } = {},
): SVGSVGElement {
  const { color = CYAN, ghost = false, tips = false } = opts
  const plan = a.plan
  const svg = blankSvg(c, height)
  if (ghost) {
    const g = strokeGroup(HAIRLINE, c.strokeWidth)
    for (const d of c.paths) g.append(svgEl('path', { d }))
    svg.append(g)
  }
  const g = strokeGroup(color, c.strokeWidth)
  const rings: { at: Pt; dashed: boolean }[] = []
  for (const [k, s] of plan.steps.entries()) {
    if (s.mode === 'retract') {
      const target = s.target === null ? null : plan.steps[s.target]
      if (tips && target && t > s.start && t < s.end) rings.push({ at: pointAt(target.segs, lengthAt(s, t - s.start)), dashed: true })
      continue
    }
    const [from, to] = windowAt(plan, k, t)
    if (to - from <= 1e-6) continue
    const p = svgEl('path', { d: s.step.d, pathLength: s.len })
    if (from > 1e-6 || to < s.len - 1e-6) {
      p.setAttribute('stroke-dasharray', `${to - from} ${s.len * 2}`)
      if (from > 1e-6) p.setAttribute('stroke-dashoffset', String(-from))
    }
    g.append(p)
    if (tips && t > s.start && t < s.end) rings.push({ at: pointAt(s.segs, to), dashed: false })
  }
  svg.append(g)
  if (tips && t <= 0 && plan.steps[0]) rings.push({ at: (plan.steps[0].segs[0] as Seg).p0, dashed: true })
  for (const r of rings) {
    svg.append(
      svgEl('circle', {
        cx: r.at.x,
        cy: r.at.y,
        r: c.strokeWidth * 0.95,
        fill: 'none',
        stroke: BONE,
        'stroke-width': 1.5,
        'vector-effect': 'non-scaling-stroke',
        'stroke-dasharray': r.dashed ? '3 3' : 'none',
      }),
    )
  }
  return svg
}

// ---------------------------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------------------------

function tonePanel(c: WordmarkCandidate, tone: 'dark' | 'light'): HTMLElement {
  const panel = htmlEl('div', `panel ${tone}`)
  const color = tone === 'dark' ? BONE : GRAPHITE
  panel.append(htmlEl('h3', '', tone === 'dark' ? 'Bone on graphite' : 'Graphite on bone'))
  const hero = htmlEl('div', 'hero')
  hero.append(markSvg(c, color, 320))
  const sizes = htmlEl('div', 'sizes')
  for (const h of [96, 32, 16]) sizes.append(sized(c, color, h))
  panel.append(hero, sizes)
  return panel
}

function cyanPanel(c: WordmarkCandidate): HTMLElement {
  const panel = htmlEl('div', 'panel dark')
  panel.append(htmlEl('h3', '', 'Pipe Cyan on graphite'))
  const row = htmlEl('div', 'sizes')
  for (const h of [320, 96, 32, 16]) row.append(sized(c, CYAN, h))
  panel.append(row)
  return panel
}

const ms = (units: number, total: number) => Math.round((units / total) * LOADER_MS)

function timelineSvg(a: Analysis): SVGSVGElement {
  const plan = a.plan
  const labelW = 120
  const barW = 760
  const msW = 130
  const rowH = 14
  const rowGap = 8
  const top = 18
  const height = top + plan.steps.length * (rowH + rowGap) + 4
  const svg = svgEl('svg', { class: 'timeline', width: labelW + barW + msW, height, viewBox: `0 0 ${labelW + barW + msW} ${height}` })
  const x = (u: number) => labelW + (u / plan.total) * barW
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const xx = x(f * plan.total)
    svg.append(svgEl('line', { x1: xx, y1: top - 4, x2: xx, y2: height, stroke: HAIRLINE, 'stroke-width': 1 }))
    const t = svgEl('text', { x: xx, y: 10, 'text-anchor': f === 0 ? 'start' : f === 1 ? 'end' : 'middle' })
    t.textContent = `${Math.round(f * 100)} % · ${Math.round(f * LOADER_MS)} ms`
    svg.append(t)
  }
  plan.steps.forEach((s, k) => {
    const y = top + k * (rowH + rowGap)
    const label = svgEl('text', { x: 0, y: y + rowH - 3 })
    label.textContent = `${k + 1} ${s.step.label}`
    svg.append(label)
    if (s.mode === 'retract') {
      svg.append(svgEl('rect', { x: x(s.start), y: y + 0.5, width: x(s.end) - x(s.start), height: rowH - 1, rx: 3, fill: 'none', stroke: G60, 'stroke-dasharray': '3 2' }))
    } else {
      let u = s.start
      for (const piece of s.pieces) {
        const d = piece.len * piece.weight
        svg.append(svgEl('rect', { x: x(u), y, width: Math.max(0.5, x(u + d) - x(u)), height: rowH, fill: piece.weight < 1 ? CYAN_DEEP : CYAN }))
        u += d
      }
    }
    const lifted = s.mode === 'draw' && k > 0 && plan.lifts.some((p) => near(p.x, (s.segs[0] as Seg).p0.x) && near(p.y, (s.segs[0] as Seg).p0.y))
    const right = svgEl('text', { x: labelW + barW + 10, y: y + rowH - 3 })
    right.textContent = `${ms(s.start, plan.total)}–${ms(s.end, plan.total)} ms${lifted ? ' · pen lift' : ''}`
    svg.append(right)
  })
  return svg
}

function drawOnPanel(c: WordmarkCandidate, a: Analysis): HTMLElement {
  const panel = htmlEl('div', 'panel dark')
  const order = c.singleStroke ? 'the pen never lifts' : 'the pen lifts once, between the m and the ³'
  panel.append(htmlEl('h3', '', `Loader draw-on (dash progress over its timeline) · ${order} · ring = pen tip, dashed ring = retracting tail`))
  const frames = htmlEl('div', 'frames')
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const frame = htmlEl('div', 'frame')
    frame.append(frameSvg(c, a, progress * a.plan.total, 120, { ghost: true, tips: true }), htmlEl('span', 'label', `${Math.round(progress * 100)} %`))
    frames.append(frame)
  }
  panel.append(frames, timelineSvg(a))
  const notes = [
    `Timeline in pen travel: ${fmt(a.plan.total)} units, shown at a ${LOADER_MS} ms loader. Darker bar = a retrace, run at ${fmt(1 / LOADER_TIMING.retraceWeight)}× speed.`,
  ]
  if (!c.singleStroke) notes.push(`After the pen lift the next stroke starts ${LOADER_TIMING.liftLead} units (${ms(LOADER_TIMING.liftLead, a.plan.total)} ms) before the previous one ends.`)
  if (a.plan.steps.some((s) => s.mode === 'retract')) notes.push('The temporary link retracts from its start (DrawSVG 0% 100% → 100% 100%) while the ³’s bottom terminal draws, so the loader ends on the resting mark.')
  panel.append(htmlEl('p', 'note', notes.join(' ')))
  return panel
}

function constructionPanel(c: WordmarkCandidate, a: Analysis): HTMLElement {
  const panel = htmlEl('div', 'panel dark')
  panel.append(htmlEl('h3', '', 'Construction · 10-unit grid · centerline · arc centers (+) · start (●) · retrace/cusp (○) · loader-only stroke (dashed)'))
  const wrap = htmlEl('div', 'construct')
  const height = 360
  const [vx, vy, vw, vh] = viewBoxOf(c)
  const pad = 10
  const svg = svgEl('svg', {
    viewBox: `${vx - pad} ${vy - pad} ${vw + pad * 2} ${vh + pad * 2}`,
    width: +((height * (vw + pad * 2)) / (vh + pad * 2)).toFixed(3),
    height,
  })
  const hair = { 'vector-effect': 'non-scaling-stroke', fill: 'none' }
  for (let x = Math.ceil((vx - pad) / 10) * 10; x <= vx + vw + pad; x += 10) {
    svg.append(svgEl('line', { x1: x, y1: vy - pad, x2: x, y2: vy + vh + pad, stroke: HAIRLINE, 'stroke-width': 1, ...hair }))
  }
  for (let y = Math.ceil((vy - pad) / 10) * 10; y <= vy + vh + pad; y += 10) {
    svg.append(svgEl('line', { x1: vx - pad, y1: y, x2: vx + vw + pad, y2: y, stroke: HAIRLINE, 'stroke-width': 1, ...hair }))
  }
  svg.append(svgEl('rect', { x: vx, y: vy, width: vw, height: vh, stroke: G60, 'stroke-width': 1, 'stroke-dasharray': '4 4', ...hair }))
  if (a.report.sup) {
    const y = vy + a.report.sup.bottom
    svg.append(svgEl('line', { x1: vx, y1: y, x2: vx + vw, y2: y, stroke: G60, 'stroke-width': 1, 'stroke-dasharray': '2 4', ...hair }))
  }
  // Group opacity (not stroke-opacity), so overlapping paths don't show their overlaps.
  const body = strokeGroup(BONE, c.strokeWidth)
  body.setAttribute('opacity', '0.16')
  for (const d of c.paths) body.append(svgEl('path', { d }))
  svg.append(body)
  for (const s of a.plan.steps) {
    if (s.mode === 'draw' && s.retractedBy !== null) {
      svg.append(svgEl('path', { d: s.step.d, stroke: CYAN, 'stroke-width': 1.25, 'stroke-dasharray': '4 3', ...hair }))
    }
  }
  for (const d of c.paths) svg.append(svgEl('path', { d, stroke: CYAN, 'stroke-width': 1.25, ...hair }))
  for (const segs of a.segs) {
    for (const s of segs) {
      svg.append(svgEl('circle', { cx: s.p1.x, cy: s.p1.y, r: 1.1, fill: BONE }))
      if (s.kind === 'arc') {
        const k = 1.6
        svg.append(svgEl('path', { d: `M${s.c.x - k} ${s.c.y} H${s.c.x + k} M${s.c.x} ${s.c.y - k} V${s.c.y + k}`, stroke: G60, 'stroke-width': 1, ...hair }))
      }
    }
  }
  for (const p of a.report.paths) {
    svg.append(svgEl('circle', { cx: p.start.x, cy: p.start.y, r: 2.4, fill: CYAN }))
    for (const r of p.reversals) svg.append(svgEl('circle', { cx: r.x, cy: r.y, r: 3.2, stroke: BONE, 'stroke-width': 1.25, ...hair }))
    for (const k of p.kinks) svg.append(svgEl('circle', { cx: k.at.x, cy: k.at.y, r: 4, stroke: '#FF5A4A', 'stroke-width': 2, ...hair }))
  }
  wrap.append(svg, reportBlock(c, a.report))
  panel.append(wrap)
  return panel
}

function reportBlock(c: WordmarkCandidate, r: CandidateReport): HTMLElement {
  const pre = htmlEl('div', 'report')
  const line = (text: string, cls = '') => {
    const span = htmlEl('span', cls, text)
    pre.append(span, document.createTextNode('\n'))
  }
  const w = c.strokeWidth
  line(`id            ${c.id}`)
  line(`stroke width  ${w}   viewBox ${c.viewBox}   (w / height = 1 / ${fmt(viewBoxOf(c)[3] / w)})`)
  line(`paths         ${c.paths.length} (resting mark; union = the mark)`)
  r.paths.forEach((p, k) => {
    const radii = Object.entries(p.radii).map(([rad, n]) => `${rad} ×${n}`).join(', ') || 'none'
    const rev = p.reversals.map((q) => `(${fmt(q.x)},${fmt(q.y)})`).join(' ') || 'none'
    line(`path ${k + 1}        ${p.segments} segments · length ${fmt(p.length)} · arcs ${radii} · retrace/cusp ${rev}`)
  })
  if (r.sup) {
    line(`³             top y ${fmt(r.sup.top)} · bottom y ${fmt(r.sup.bottom)} · ${fmt(r.sup.ratio * 100)} % of the m's height`)
  }
  line(`m → ³ gap     ${fmt(r.gap)} (${fmt(r.gap / w)}w; ${fmt((r.gap * 16) / viewBoxOf(c)[3])} px at 16 px)`, r.gap >= w - 1e-6 ? 'ok' : 'bad')
  line(`16 px         ${fmt(r.widthAt16)} px wide${Number.isInteger(+r.widthAt16.toFixed(6)) ? ' (whole pixels)' : ' (FRACTIONAL)'}`, Number.isInteger(+r.widthAt16.toFixed(6)) ? 'ok' : 'bad')
  const steps = r.loader.steps.map((s) => `${s.label}${s.mode === 'retract' ? ' (retract)' : ''}`).join(' → ')
  line(`loader        ${steps}`)
  line(
    `pen lifts     ${r.loader.lifts.length ? r.loader.lifts.map((p) => `(${fmt(p.x)},${fmt(p.y)})`).join(' ') : 'none: one unbroken stroke'} · singleStroke ${c.singleStroke}`,
  )
  line(`loader end    ${r.loader.restDiff === 0 ? 'identical to the resting mark' : `differs in ${r.loader.restDiff} px`}${r.loader.withinViewBox ? '' : ' · LEAVES THE VIEWBOX'}`, r.loader.restDiff === 0 && r.loader.withinViewBox ? 'ok' : 'bad')
  line(`kinks         ${r.kinks}`, r.kinks ? 'bad' : 'ok')
  line(`viewBox       ${r.viewBoxMatches ? 'tight (matches stroke bounds)' : 'MISMATCH'}`, r.viewBoxMatches ? 'ok' : 'bad')
  for (const e of r.errors) line(`error         ${e}`, 'bad')
  return pre
}

function resemblancePanel(c: WordmarkCandidate, a: Analysis): HTMLElement {
  const panel = htmlEl('div', 'panel dark')
  panel.append(htmlEl('h3', '', 'Side by side with the Muni worm · schematic of its construction, not the logo · same x-height'))
  const retract = a.plan.steps.find((s) => s.mode === 'retract')
  for (const h of [96, 32]) {
    const row = htmlEl('div', 'sizes compare')
    row.append(labelled(markSvg(c, BONE, h), `${c.name}, at rest · ${h} px`))
    if (retract) row.append(labelled(frameSvg(c, a, retract.start, h, { color: BONE }), `mid-loader, link fully drawn · ${h} px`))
    row.append(labelled(muniSvg(BONE, h), `Muni worm (schematic) · ${h} px`))
    panel.append(row)
  }
  panel.append(
    htmlEl(
      'p',
      'note',
      'The schematic is built from the worm’s traits only: one uniform heavy stroke, tight round arches and cups, m-u-n linked (the m’s last stem turns straight into the u on the baseline), a dotted i. The real logo is not in the repo.',
    ),
  )
  return panel
}

async function studyPanel(c: WordmarkCandidate): Promise<HTMLElement> {
  const s3 = slotS3(c)
  const a = await analyse(s3)
  const panel = htmlEl('div', 'panel dark')
  panel.append(htmlEl('h3', '', 'Study (critique S3, not adopted) · round 50-unit ³ (kept) vs squared 60-unit ³ with 5-unit flats'))
  for (const h of [96, 32, 16]) {
    const row = htmlEl('div', 'sizes compare')
    row.append(sized(c, BONE, h, `kept · ³ 62.5 % · ${h} px`), sized(s3, BONE, h, `S3 · ³ ${fmt((a.report.sup?.ratio ?? 0) * 100)} % · ${h} px`))
    panel.append(row)
  }
  panel.append(
    htmlEl(
      'p',
      'note',
      `S3 geometry: kinks ${a.report.kinks}, viewBox ${a.report.viewBoxMatches ? 'tight' : 'mismatch'}, counters 15. It squares the ³ to the m, but the ³ grows to ${fmt((a.report.sup?.ratio ?? 0) * 100)} % of the m (the brief allows 55–62 %), the superscript cue weakens and at 16 px the ³ reads as a second full-size glyph.`,
    ),
  )
  return panel
}

async function loupe(c: WordmarkCandidate, fg: string, bg: string, cssHeight: number, dpr: number, zoom: number): Promise<HTMLCanvasElement> {
  const [, , vw, vh] = viewBoxOf(c)
  const pad = 3
  const hPx = cssHeight * dpr
  const wPx = (hPx * vw) / vh
  const canvas = htmlEl('canvas')
  canvas.width = Math.ceil(wPx) + pad * 2 * dpr
  canvas.height = hPx + pad * 2 * dpr
  canvas.style.width = `${(canvas.width / dpr) * zoom}px`
  canvas.style.height = `${(canvas.height / dpr) * zoom}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wordmarkSvg(c, { color: fg, height: hPx }))}`
  await img.decode()
  ctx.drawImage(img, pad * dpr, pad * dpr, wPx, hPx)
  return canvas
}

async function smallSizePanel(c: WordmarkCandidate): Promise<HTMLElement> {
  const panel = htmlEl('div', 'panel dark')
  panel.append(htmlEl('h3', '', '16 px, actual pixels ×8 (1x and 2x screens) · nav mock at 16 px'))
  const loupes = htmlEl('div', 'loupes')
  const specs: [string, string, number][] = [
    [BONE, GRAPHITE, 1],
    [GRAPHITE, BONE, 1],
    [BONE, GRAPHITE, 2],
    [GRAPHITE, BONE, 2],
  ]
  for (const [fg, bg, dpr] of specs) {
    const box = htmlEl('div', 'size')
    box.append(await loupe(c, fg, bg, 16, dpr, 8), htmlEl('span', 'label', `16 px @${dpr}x`))
    loupes.append(box)
  }
  const navs = htmlEl('div', 'navs')
  navs.style.marginTop = '20px'
  for (const tone of ['dark', 'light'] as const) {
    const nav = htmlEl('div', `nav ${tone}`)
    nav.append(markSvg(c, tone === 'dark' ? BONE : GRAPHITE, 16))
    const links = htmlEl('div', 'links')
    for (const t of ['Idea', 'How it works', 'Modular', 'Connected', 'Specs']) links.append(htmlEl('span', '', t))
    nav.append(links, htmlEl('span', 'pill', 'Get in touch'))
    navs.append(nav)
  }
  panel.append(loupes, navs)
  return panel
}

function lineup(): HTMLElement {
  const wrap = htmlEl('div', 'lineup')
  for (const tone of ['dark', 'light'] as const) {
    const panel = htmlEl('div', `panel ${tone}`)
    const color = tone === 'dark' ? BONE : GRAPHITE
    panel.append(htmlEl('h3', '', `All candidates at rest · 96 / 32 / 16 px · ${tone === 'dark' ? 'bone on graphite' : 'graphite on bone'}`))
    const row = htmlEl('div', 'sizes')
    for (const c of wordmarks) {
      const twin = wordmarks.find((o) => o !== c && o.paths.join('|') === c.paths.join('|') && wordmarks.indexOf(o) < wordmarks.indexOf(c))
      row.append(sized(c, color, 96, twin ? `${c.name} (rests as ${twin.name})` : c.name))
    }
    if (SHOW_MUNI) row.append(labelled(muniSvg(color, 96), 'Muni worm (schematic)'))
    const small = htmlEl('div', 'sizes')
    small.style.marginTop = '24px'
    for (const c of wordmarks) {
      small.append(sized(c, color, 32, `${c.name} 32`))
      small.append(sized(c, color, 16, '16'))
    }
    panel.append(row, small)
    wrap.append(panel)
  }
  return wrap
}

async function candidateSection(c: WordmarkCandidate, index: number, a: Analysis): Promise<HTMLElement> {
  const section = htmlEl('section', 'cand')
  section.dataset.candidate = c.id
  const head = htmlEl('header', 'cand-head')
  head.append(htmlEl('h2', '', `${index + 1} · ${c.name}`))
  head.append(htmlEl('span', `chip ${c.singleStroke ? 'yes' : 'no'}`, c.singleStroke ? 'single stroke loader' : 'm, then ³ (pen lifts once)'))
  head.append(htmlEl('span', 'meta', `id ${c.id} · viewBox ${c.viewBox} · stroke ${c.strokeWidth}`))
  head.append(htmlEl('p', 'desc', c.description))
  section.append(head)
  const tones = htmlEl('div', 'grid2')
  tones.append(tonePanel(c, 'dark'), tonePanel(c, 'light'))
  section.append(tones, cyanPanel(c), drawOnPanel(c, a), constructionPanel(c, a))
  if (SHOW_MUNI) section.append(resemblancePanel(c, a))
  if (c.id === 'slot') section.append(await studyPanel(c))
  section.append(await smallSizePanel(c))
  return section
}

async function main(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) throw new Error('#app missing')
  const analyses = await Promise.all(wordmarks.map(analyse))
  app.append(lineup())
  for (const [k, c] of wordmarks.entries()) {
    app.append(await candidateSection(c, k, analyses[k] as Analysis))
  }
  window.__wordmarkReport = analyses.map((a) => a.report)
  document.documentElement.dataset.ready = '1'
}

main().catch((e: unknown) => {
  console.error(e)
  document.documentElement.dataset.ready = 'error'
})
