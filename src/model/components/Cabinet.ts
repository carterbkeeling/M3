import * as THREE from 'three'
import type { MachineConfig } from '../config.ts'
import type { Layout } from '../dims.ts'
import type { MachineMaterials } from '../materials.ts'
import { profileArc, roundedRectOutline, roundedSlab, sweepProfile, type Profile } from '../shapes.ts'

// The molded body: a swept outer skin with rounded front and back rims, a flat bezel plate with
// one opening per slot (the seam between them is the parting line), a back plate with molded ribs,
// a recessed plinth and leveling feet.

export interface CabinetParts {
  group: THREE.Group
  skin: THREE.Mesh
  bezel: THREE.Mesh
  back: THREE.Mesh
  plinth: THREE.Mesh
}

const BEZEL_INSET = 0.014 // width of the skin's front rim ring; the bezel plate sits inside it
export const BEZEL_DEPTH = 0.02

export function buildCabinet(cfg: MachineConfig, L: Layout, m: MachineMaterials): CabinetParts {
  const group = new THREE.Group()
  group.name = 'Cabinet'
  const R = cfg.radius.edge
  const Hs = L.H - L.skinBottom
  const cy = L.skinBottom + Hs / 2

  // Outer skin: sweep the rim profile around the front outline.
  // n is the offset along the outward normal, z is depth. Runs front-inner → front rim → side wall → back rim → back-inner.
  const ribDepth = 0.012
  const zF = L.zFront
  const zB = L.zBack + ribDepth // ribs stand proud of the back face, inside the overall depth
  const profile: Profile = [
    [-BEZEL_INSET, zF],
    ...profileArc(-R, zF - R, R, Math.PI / 2, 0),
    ...profileArc(-R, zB + R, R, 0, -Math.PI / 2),
    [-BEZEL_INSET, zB],
  ]
  const skinGeo = sweepProfile(roundedRectOutline(L.W, Hs, cfg.radius.corner, 12), profile)
  skinGeo.translate(0, cy, 0)
  const skin = new THREE.Mesh(skinGeo, m.body)
  skin.name = 'Skin'

  // Bezel plate with slot openings. Its front face is flush with the skin's front ring.
  const holes = L.slots.map((s) => ({ w: s.w, h: s.h, r: cfg.radius.inner, cx: s.x, cy: s.y - cy }))
  const bezelGeo = roundedSlab(L.W - 2 * BEZEL_INSET, Hs - 2 * BEZEL_INSET, BEZEL_DEPTH, cfg.radius.corner - BEZEL_INSET, 0.004, holes)
  bezelGeo.translate(0, cy, zF - BEZEL_DEPTH + 0.0005)
  const bezel = new THREE.Mesh(bezelGeo, m.body)
  bezel.name = 'Bezel'

  // Back plate closes the skin at the rear; ribs stand on it.
  const backGeo = roundedSlab(L.W - 2 * BEZEL_INSET, Hs - 2 * BEZEL_INSET, 0.012, cfg.radius.corner - BEZEL_INSET, 0.003)
  backGeo.translate(0, cy, zB - 0.0005)
  const back = new THREE.Mesh(backGeo, m.body)
  back.name = 'Back'

  // Molded ribs on the back: vertical ribs plus two cross ribs.
  const ribs = new THREE.Group()
  ribs.name = 'BackRibs'
  const nV = Math.max(3, cfg.grid.cols * 2 + 1)
  for (let i = 0; i < nV; i++) {
    const x = -L.W / 2 + 0.08 + (i * (L.W - 0.16)) / (nV - 1)
    const g = roundedSlab(0.014, Hs - 0.16, ribDepth, 0.006, 0.003)
    g.rotateY(Math.PI)
    g.translate(x, cy, zB + 0.0005)
    ribs.add(new THREE.Mesh(g, m.body))
  }
  for (const y of [L.skinBottom + Hs * 0.3, L.skinBottom + Hs * 0.7]) {
    const g = roundedSlab(L.W - 0.14, 0.014, ribDepth * 0.7, 0.006, 0.003)
    g.rotateY(Math.PI)
    g.translate(0, y, zB + 0.0005)
    ribs.add(new THREE.Mesh(g, m.body))
  }

  // Recessed plinth and four leveling feet.
  const plinthH = L.skinBottom - L.feet
  const plinthGeo = roundedSlab(L.W - 0.06, L.D - 0.08, plinthH, 0.02, 0.004)
  plinthGeo.rotateX(-Math.PI / 2)
  plinthGeo.translate(0, L.feet, -0.02)
  const plinth = new THREE.Mesh(plinthGeo, m.body)
  plinth.name = 'Plinth'

  const feet = new THREE.Group()
  feet.name = 'Feet'
  const footGeo = new THREE.CylinderGeometry(0.022, 0.026, L.feet, 20)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const f = new THREE.Mesh(footGeo, m.feet)
      f.position.set(sx * (L.W / 2 - 0.07), L.feet / 2, sz * (L.D / 2 - 0.1) - 0.02)
      feet.add(f)
    }
  }

  group.add(skin, bezel, back, ribs, plinth, feet)
  return { group, skin, bezel, back, plinth }
}
