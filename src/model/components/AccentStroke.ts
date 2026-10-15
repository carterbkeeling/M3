import * as THREE from 'three'
import type { MachineConfig } from '../config.ts'
import type { MachineMaterials } from '../materials.ts'
import { PolylineCurve3 } from '../shapes.ts'
import type { StrokePath, StrokePiece } from '../strokePath.ts'

// The accent stroke as a molded light pipe, half set into the bezel. Each visible run of the path
// is ONE seamless tube; each slot's stretch is a material group with its own material, so its
// light can change state independently. The reader's capsule ring is its own closed tube.

export interface StrokeParts {
  group: THREE.Group
  lights: Map<number, THREE.MeshStandardMaterial>
  ring: THREE.Mesh | null
}

const RADIAL = 16

export function buildAccentStroke(cfg: MachineConfig, path: StrokePath, zFront: number, m: MachineMaterials): StrokeParts {
  const group = new THREE.Group()
  group.name = 'AccentStroke'
  const radius = cfg.stroke.width / 2
  const z = zFront + 0.0005
  const lights = new Map<number, THREE.MeshStandardMaterial>()
  const capGeo = new THREE.SphereGeometry(radius, RADIAL, 12)

  // Split the path into runs of consecutive visible pieces (the hidden stretch passes under the reader).
  const runs: StrokePiece[][] = [[]]
  for (const piece of path.pieces) {
    if (piece.hidden) runs.push([])
    else runs[runs.length - 1].push(piece)
  }

  for (const run of runs) {
    if (!run.length) continue
    const pts: THREE.Vector3[] = []
    const ranges: Array<{ slot: number | null; a: number; b: number }> = []
    for (const piece of run) {
      if (piece.points.length < 2) continue
      const a = Math.max(0, pts.length - 1)
      piece.points.forEach(([x, y], i) => {
        const prev = pts[pts.length - 1]
        if (i === 0 && prev && Math.hypot(prev.x - x, prev.y - y) < 1e-6) return
        pts.push(new THREE.Vector3(x, y, z))
      })
      ranges.push({ slot: piece.slot, a, b: pts.length - 1 })
    }
    if (pts.length < 2) continue
    const cum = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    const total = cum[cum.length - 1]
    const segs = Math.max(4, Math.ceil(total / 0.003))
    const geo = new THREE.TubeGeometry(new PolylineCurve3(pts), segs, radius, RADIAL, false)
    geo.clearGroups()
    const materials: THREE.Material[] = [m.pipeConnector]
    for (const { slot, a, b } of ranges) {
      const j0 = Math.round((cum[a] / total) * segs)
      const j1 = Math.round((cum[b] / total) * segs)
      if (j1 <= j0) continue
      let index = 0
      if (slot !== null) {
        let mat = lights.get(slot)
        if (!mat) {
          mat = m.pipeSegment()
          lights.set(slot, mat)
        }
        if (!materials.includes(mat)) materials.push(mat)
        index = materials.indexOf(mat)
      }
      geo.addGroup(j0 * RADIAL * 6, (j1 - j0) * RADIAL * 6, index)
    }
    const mesh = new THREE.Mesh(geo, materials)
    mesh.name = 'Stroke'
    group.add(mesh)
    // Round caps where a run starts or ends.
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const cap = new THREE.Mesh(capGeo, m.pipeConnector)
      cap.position.copy(p)
      group.add(cap)
    }
  }

  let ring: THREE.Mesh | null = null
  if (path.ring) {
    const pts = path.ring.map(([x, y]) => new THREE.Vector3(x, y, z))
    const curve = new THREE.CatmullRomCurve3(pts, true)
    ring = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(64, pts.length * 2), radius, RADIAL, true), m.readerRing)
    ring.name = 'ReaderRing'
    group.add(ring)
  }
  return { group, lights, ring }
}
