import * as THREE from 'three'

// Geometry helpers for the molded-plastic look: rounded rectangles, swept wall profiles,
// beveled slabs and constant-radius tube paths. All DOM-free.

export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape()
  addRoundedRect(s, w, h, r, cx, cy)
  return s
}

export function roundedRectPath(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Path {
  const p = new THREE.Path()
  addRoundedRect(p, w, h, r, cx, cy)
  return p
}

function addRoundedRect(p: THREE.Path, w: number, h: number, r: number, cx: number, cy: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const x1 = cx + w / 2
  const y1 = cy + h / 2
  p.moveTo(x0 + rr, y0)
  p.lineTo(x1 - rr, y0)
  p.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false)
  p.lineTo(x1, y1 - rr)
  p.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false)
  p.lineTo(x0 + rr, y1)
  p.absarc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI, false)
  p.lineTo(x0, y0 + rr)
  p.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false)
}

export interface Outline {
  points: THREE.Vector2[]
  normals: THREE.Vector2[] // outward, unit
}

// Closed CCW rounded-rectangle outline with outward normals, for sweeping wall profiles.
export function roundedRectOutline(w: number, h: number, r: number, cornerSegments = 10): Outline {
  const points: THREE.Vector2[] = []
  const normals: THREE.Vector2[] = []
  const rr = Math.max(1e-5, Math.min(r, w / 2, h / 2))
  const corners: Array<[number, number, number]> = [
    [w / 2 - rr, -h / 2 + rr, -Math.PI / 2],
    [w / 2 - rr, h / 2 - rr, 0],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -h / 2 + rr, Math.PI],
  ]
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = a0 + (i / cornerSegments) * (Math.PI / 2)
      const n = new THREE.Vector2(Math.cos(a), Math.sin(a))
      points.push(new THREE.Vector2(cx + n.x * rr, cy + n.y * rr))
      normals.push(n)
    }
  }
  return { points, normals }
}

// A wall cross-section as (n, z) pairs: n = offset along the outline's outward normal, z = depth.
export type Profile = Array<[number, number]>

// Quarter arc in the profile plane, from angle a0 to a1 (radians) around (cn, cz).
export function profileArc(cn: number, cz: number, r: number, a0: number, a1: number, segments = 6): Profile {
  const out: Profile = []
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments
    out.push([cn + Math.cos(a) * r, cz + Math.sin(a) * r])
  }
  return out
}

// Sweep a profile around a closed outline (the outline lies in XY, profile z maps to Z).
// Faces point outward when the profile runs front (high z) to back along the outer wall;
// pass flip for profiles that run the other way.
export function sweepProfile(outline: Outline, profile: Profile, flip = false): THREE.BufferGeometry {
  const { points, normals } = outline
  const m = points.length
  const k = profile.length
  const pos = new Float32Array(m * k * 3)
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < k; j++) {
      const [n, z] = profile[j]
      const o = (i * k + j) * 3
      pos[o] = points[i].x + normals[i].x * n
      pos[o + 1] = points[i].y + normals[i].y * n
      pos[o + 2] = z
    }
  }
  const index: number[] = []
  for (let i = 0; i < m; i++) {
    const i2 = (i + 1) % m
    for (let j = 0; j < k - 1; j++) {
      const a = i * k + j
      const b = i2 * k + j
      const c = i2 * k + j + 1
      const d = i * k + j + 1
      if (flip) index.push(a, b, d, b, c, d)
      else index.push(a, d, b, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

export interface SlabHole {
  w: number
  h: number
  r: number
  cx: number
  cy: number
}

// A flat plate w×h×t (z from 0 to t) with corner radius r, edges rounded by bevel b,
// optional rounded-rect holes. Outer size is exact (bevel is compensated).
export function roundedSlab(w: number, h: number, t: number, r: number, b: number, holes: SlabHole[] = []): THREE.BufferGeometry {
  const bb = Math.min(b, t / 2 - 1e-4)
  const shape = roundedRectShape(w - 2 * bb, h - 2 * bb, Math.max(r - bb, 1e-4))
  for (const hole of holes) {
    shape.holes.push(roundedRectPath(hole.w + 2 * bb, hole.h + 2 * bb, hole.r + bb, hole.cx, hole.cy))
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(t - 2 * bb, 1e-4),
    bevelEnabled: bb > 0,
    bevelThickness: bb,
    bevelSize: bb,
    bevelSegments: 3,
    curveSegments: 8,
  })
  g.translate(0, 0, bb)
  g.computeVertexNormals()
  return g
}

// Arc-length parameterized polyline, so TubeGeometry follows sampled turtle paths exactly.
export class PolylineCurve3 extends THREE.Curve<THREE.Vector3> {
  private readonly pts: THREE.Vector3[]
  private readonly cum: number[]
  readonly total: number

  constructor(pts: THREE.Vector3[]) {
    super()
    this.pts = pts
    this.cum = [0]
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    this.total = this.cum[this.cum.length - 1]
  }

  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const d = Math.min(Math.max(t, 0), 1) * this.total
    let lo = 0
    let hi = this.cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (this.cum[mid] <= d) lo = mid
      else hi = mid
    }
    const seg = this.cum[hi] - this.cum[lo] || 1
    return target.copy(this.pts[lo]).lerp(this.pts[hi], (d - this.cum[lo]) / seg)
  }
}

// A molded U-handle: leaves the surface, runs `length` parallel to it at `standoff`, returns.
// Constant bend radius `r`. Built in a local frame: along +Y, standing off toward +Z.
export function uHandlePoints(length: number, standoff: number, r: number, step = 0.003): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const rr = Math.min(r, standoff / 2, length / 2)
  const push = (y: number, z: number) => pts.push(new THREE.Vector3(0, y, z))
  // Start on the surface, rise to standoff with a quarter arc, run, and come back.
  const y0 = -length / 2
  const y1 = length / 2
  for (let z = 0; z < standoff - rr; z += step) push(y0, z)
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * (Math.PI / 2)
    push(y0 + rr + Math.cos(a) * rr, standoff - rr - Math.sin(a) * rr)
  }
  for (let y = y0 + rr; y < y1 - rr; y += step) push(y, standoff)
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 - (i / 8) * (Math.PI / 2)
    push(y1 - rr + Math.cos(a) * rr, standoff - rr + Math.sin(a) * rr)
  }
  for (let z = standoff - rr; z >= 0; z -= step) push(y1, z)
  return pts
}
