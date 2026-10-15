import type { MachineConfig } from './config.ts'
import type { Layout } from './dims.ts'

// The accent stroke: one continuous path on the bezel face, uniform width, constant-radius turns.
// It starts as a loop around the reader, then routes across the front. Every slot owns exactly
// one stretch of it (its status light). Pure 2D math in the bezel plane (x right, y up).

export interface StrokePiece {
  slot: number | null // slot index that owns this stretch, or null for connecting stroke
  points: Array<[number, number]>
}

export interface StrokePath {
  pieces: StrokePiece[]
  reader: { x: number; y: number; loopR: number }
}

type Vec = [number, number]

class Turtle {
  x: number
  y: number
  heading: number // radians, 0 = +x
  private readonly step: number
  private current: StrokePiece
  readonly pieces: StrokePiece[] = []

  constructor(x: number, y: number, heading: number, step = 0.004) {
    this.x = x
    this.y = y
    this.heading = heading
    this.step = step
    this.current = { slot: null, points: [[x, y]] }
  }

  own(slot: number | null) {
    if (this.current.slot === slot) return
    if (this.current.points.length > 1) this.pieces.push(this.current)
    this.current = { slot, points: [[this.x, this.y]] }
  }

  forward(d: number) {
    if (d <= 1e-7) return
    const n = Math.max(1, Math.ceil(d / this.step))
    const dx = Math.cos(this.heading)
    const dy = Math.sin(this.heading)
    const x0 = this.x
    const y0 = this.y
    for (let i = 1; i <= n; i++) {
      this.x = x0 + (dx * d * i) / n
      this.y = y0 + (dy * d * i) / n
      this.current.points.push([this.x, this.y])
    }
  }

  // Positive angle turns left (CCW), negative turns right. Constant radius r.
  arc(angle: number, r: number) {
    if (Math.abs(angle) < 1e-9) return
    const side = Math.sign(angle)
    const cx = this.x + Math.cos(this.heading + (side * Math.PI) / 2) * r
    const cy = this.y + Math.sin(this.heading + (side * Math.PI) / 2) * r
    const start = Math.atan2(this.y - cy, this.x - cx)
    const n = Math.max(2, Math.ceil(Math.abs(angle) / (Math.PI / 36)))
    for (let i = 1; i <= n; i++) {
      const a = start + (angle * i) / n
      this.x = cx + Math.cos(a) * r
      this.y = cy + Math.sin(a) * r
      this.current.points.push([this.x, this.y])
    }
    this.heading += angle
  }

  // Bulge sideways by d toward world direction `toward` and come back, over `length` of travel.
  // Four constant-radius arcs (an S out, an S back) with a straight hold between.
  lobe(length: number, d: number, r: number, toward: Vec, slot: number) {
    const leftX = -Math.sin(this.heading)
    const leftY = Math.cos(this.heading)
    const sign = Math.sign(leftX * toward[0] + leftY * toward[1]) || 1
    const theta = Math.acos(Math.max(-1, Math.min(1, 1 - d / (2 * r))))
    const run = 4 * r * Math.sin(theta)
    this.own(slot)
    this.arc(sign * theta, r)
    this.arc(-sign * theta, r)
    this.forward(Math.max(0, length - run))
    this.arc(-sign * theta, r)
    this.arc(sign * theta, r)
    this.own(null)
  }

  finish(): StrokePiece[] {
    if (this.current.points.length > 1) this.pieces.push(this.current)
    return this.pieces
  }
}

// A feature along a straight route segment, in that segment's own distance coordinate s.
type Feature =
  | { kind: 'lobe'; s0: number; length: number; slot: number; toward: Vec; amp: number }
  | { kind: 'own'; s0: number; s1: number; slot: number }

interface Segment {
  to: Vec
  features: Feature[]
}

// Follow an axis-aligned route, filleting every corner with radius r and applying features.
function follow(t: Turtle, start: Vec, segments: Segment[], r: number) {
  // Turn direction at each joint (0 = collinear, no turn and no trim).
  const starts: Vec[] = [start, ...segments.slice(0, -1).map((s) => s.to)]
  const dirOf = (i: number): Vec => [Math.sign(segments[i].to[0] - starts[i][0]), Math.sign(segments[i].to[1] - starts[i][1])]
  const turnAt = segments.map((_, i) => {
    if (i === segments.length - 1) return 0
    const d0 = dirOf(i)
    const d1 = dirOf(i + 1)
    return Math.sign(d0[0] * d1[1] - d0[1] * d1[0])
  })
  let from = start
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const len = Math.hypot(seg.to[0] - from[0], seg.to[1] - from[1])
    const startTrim = i > 0 && turnAt[i - 1] !== 0 ? r : 0
    const endTrim = turnAt[i] !== 0 ? r : 0
    let s = startTrim
    const feats = [...seg.features].sort((a, b) => a.s0 - b.s0)
    for (const f of feats) {
      t.forward(f.s0 - s)
      if (f.kind === 'lobe') {
        t.lobe(f.length, f.amp, r, f.toward, f.slot)
        s = f.s0 + f.length
      } else {
        t.own(f.slot)
        t.forward(f.s1 - f.s0)
        t.own(null)
        s = f.s1
      }
    }
    t.forward(len - endTrim - s)
    if (turnAt[i] !== 0) t.arc(turnAt[i] * (Math.PI / 2), r)
    from = seg.to
  }
}

export function buildStrokePath(cfg: MachineConfig, L: Layout): StrokePath {
  const r = cfg.stroke.turnRadius
  // Reader sits high in the header so both the loop and the route under it fit. For the spine it
  // sits so the loop's left tangent lands on the first mullion: the stroke leaves the loop and
  // drops straight down the spine with no jog.
  const loopR = 0.04
  const onMullion = cfg.stroke.path === 'spine' && cfg.grid.cols > 1
  const reader = { x: onMullion ? L.mullionX[0] + loopR : 0, y: L.H - 0.065, loopR }

  // Start on the loop just past its lowest-left point, run CCW once around the reader,
  // and leave heading straight down from its left side.
  const a0 = (230 * Math.PI) / 180
  const sx = reader.x + Math.cos(a0) * loopR
  const sy = reader.y + Math.sin(a0) * loopR
  const t = new Turtle(sx, sy, a0 + Math.PI / 2)
  t.arc((540 * Math.PI) / 180 - a0, loopR)
  const exit: Vec = [reader.x - loopR, reader.y] // snap away arc sampling error so lanes line up exactly
  t.x = exit[0]
  t.y = exit[1]

  const segments = cfg.stroke.path === 'serpentine' ? serpentineRoute(cfg, L, exit) : spineRoute(cfg, L, exit)
  follow(t, exit, segments, r)
  return { pieces: t.finish(), reader }
}

// Height of the route that runs under the reader loop, and of the run along the lower frame.
function headY(L: Layout) {
  return L.slotTop + 0.036
}
function baseY(L: Layout) {
  return (L.skinBottom + 0.014 + L.slots[L.slots.length - 1].bottom) / 2
}

// Spine: down each mullion (or the left side frame for one column), one lobe per slot,
// lanes linked alternately across the base and the header.
function spineRoute(cfg: MachineConfig, L: Layout, exit: Vec): Segment[] {
  const { cols, rows } = cfg.grid
  const r = cfg.stroke.turnRadius
  const lanes = cols > 1 ? L.mullionX : [L.sideX[0]]
  const laneWidth = cols > 1 ? cfg.cabinet.mullion : cfg.cabinet.side
  // Lobe depth: as deep as the lane allows while keeping 7 mm clear of the door gaps. At 2r every
  // turn is a true quarter arc; narrower lanes fall back to straight owned stretches, never kinks.
  const amp = Math.min(2 * r, laneWidth / 2 - cfg.stroke.width / 2 - 0.007)
  const lobes = amp >= 2 * r - 1e-9
  const lobeRun = 4 * r // length of travel one quarter-arc lobe takes, with no hold
  const yHead = headY(L)
  const yBase = baseY(L)
  const segs: Segment[] = [{ to: [exit[0], yHead], features: [] }]
  if (Math.abs(lanes[0] - exit[0]) > 1e-6) segs.push({ to: [lanes[0], yHead], features: [] })

  lanes.forEach((x, k) => {
    const down = k % 2 === 0
    const yFrom = down ? yHead : yBase
    const yTo = down ? yBase : yHead
    const sOf = (y: number) => Math.abs(y - yFrom)
    const features: Feature[] = []
    const hasLeft = cols > 1
    const hasRight = cols === 1 || k === lanes.length - 1
    const place = (yc: number, len: number, slot: number, toward: Vec) => {
      if (lobes) features.push({ kind: 'lobe', s0: sOf(yc) - len / 2, length: len, slot, toward, amp })
      else features.push({ kind: 'own', s0: sOf(yc) - len / 2, s1: sOf(yc) + len / 2, slot })
    }
    for (let row = 0; row < rows; row++) {
      const s0 = L.slots[row * cols]
      const leftSlot = row * cols + k
      const rightSlot = cols === 1 ? row * cols : row * cols + k + 1
      if (hasLeft && hasRight) {
        // One compact S per row at the row's center: upper lobe → left door, lower → right door.
        const len = lobes ? lobeRun : 0.07
        place(s0.y + (len + r) / 2, len, leftSlot, [-1, 0])
        place(s0.y - (len + r) / 2, len, rightSlot, [1, 0])
      } else if (hasLeft) {
        place(s0.y, lobes ? lobeRun : 0.12, leftSlot, [-1, 0])
      } else {
        place(s0.y, lobes ? lobeRun : 0.12, rightSlot, [1, 0])
      }
    }
    segs.push({ to: [x, yTo], features })
    const next = lanes[k + 1]
    if (next !== undefined) segs.push({ to: [next, yTo], features: [] })
  })
  // With an even number of lanes the last one ends heading up into the header: finish by
  // turning outward along the header instead of stopping in open space.
  if (lanes.length % 2 === 0 && lanes.length > 1) {
    segs.push({ to: [L.sideX[1] - 2 * r, yHead], features: [] })
  }
  return segs
}

// Serpentine ("rail serpentine"): boustrophedon along the rail above each row; each slot owns
// the run above it. It does not loop around each door.
function serpentineRoute(cfg: MachineConfig, L: Layout, exit: Vec): Segment[] {
  const { cols, rows } = cfg.grid
  const [xL, xR] = L.sideX
  const yHead = headY(L)
  const segs: Segment[] = [
    { to: [exit[0], yHead], features: [] },
    { to: [xL, yHead], features: [] },
  ]
  for (let row = 0; row < rows; row++) {
    const s0 = L.slots[row * cols]
    const y = row === 0 ? L.slotTop + 0.012 : s0.top + cfg.cabinet.rail / 2
    const eastward = row % 2 === 0
    const xFrom = eastward ? xL : xR
    const xTo = eastward ? xR : xL
    // vertical connector down the side frame to this run
    segs.push({ to: [xFrom, y], features: [] })
    const features: Feature[] = []
    for (let col = 0; col < cols; col++) {
      const slot = L.slots[row * cols + col]
      const inset = 0.01
      const a = Math.abs((eastward ? slot.left : slot.right) - xFrom) + inset
      const b = Math.abs((eastward ? slot.right : slot.left) - xFrom) - inset
      features.push({ kind: 'own', s0: a, s1: b, slot: slot.index })
    }
    segs.push({ to: [xTo, y], features })
  }
  return segs
}
