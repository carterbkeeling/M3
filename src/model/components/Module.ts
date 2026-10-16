import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { MachineConfig, ModuleSpec } from '../config.ts'
import type { SlotRect } from '../dims.ts'
import type { MachineMaterials } from '../materials.ts'
import { profileArc, roundedRectOutline, roundedSlab, sweepProfile, type Profile } from '../shapes.ts'
import { cached, keyOf } from '../geometryCache.ts'
import { buildContents } from './Contents.ts'
import { buildDoor, type DoorParts } from './Door.ts'
import { RAIL_H } from './Fitment.ts'

// A module: a closed molded tub carrying its own door, lock, placard and contents.
// Its origin sits on the bezel plane at the slot center; pulling it out moves it along +z.

export interface ModuleParts {
  group: THREE.Group
  door: DoorParts
  spec: ModuleSpec
  depth: number
}

export function buildModule(cfg: MachineConfig, s: SlotRect, spec: ModuleSpec, zFront: number, cavityBack: number, m: MachineMaterials): ModuleParts {
  const group = new THREE.Group()
  group.name = `Module ${s.index}`
  const wall = cfg.wall
  const tw = s.w - 0.016
  const th = s.h - RAIL_H - 0.012
  const depth = zFront - cavityBack - 0.006 - 0.02
  const zTubFront = -0.006
  const zTubBack = zTubFront - depth
  const R = 0.008

  // Tub: swept outer wall with a rounded back rim, open front, plain inner liner, back cap.
  const tub = new THREE.Group()
  tub.name = 'Tub'
  const profile: Profile = [
    [-wall, zTubFront],
    [0, zTubFront],
    ...profileArc(-R, zTubBack + R, R, 0, -Math.PI / 2),
    [-R - 0.002, zTubBack],
  ]
  // Every module is the same size, so all of them share these geometries.
  const k = (name: string) => keyOf(name, tw, th, depth, wall, cfg.radius.edge)
  const outer = new THREE.Mesh(cached(k('tub.outer'), () => sweepProfile(roundedRectOutline(tw, th, 0.009, 8), profile)), m.door)
  const cap = new THREE.Mesh(cached(k('tub.cap'), () => roundedSlab(tw - 2 * R, th - 2 * R, 0.003, 0.004, 0.001)), m.door)
  cap.position.z = zTubBack
  const linerGeo = cached(k('tub.liner'), () => new THREE.BoxGeometry(tw - 2 * wall, th - 2 * wall, depth - wall))
  const liner = new THREE.Mesh(linerGeo, m.interior)
  liner.position.z = zTubFront - (depth - wall) / 2
  tub.add(outer, cap, liner)

  // Molded front collar: the rim the door closes against.
  const collar = new THREE.Mesh(
    cached(k('tub.collar'), () =>
      roundedSlab(tw + 0.012, th + 0.012, 0.014, cfg.radius.edge, 0.003, [{ w: tw - 2 * wall, h: th - 2 * wall, r: 0.006, cx: 0, cy: 0 }]),
    ),
    m.door,
  )
  collar.position.z = zTubFront - 0.014
  tub.add(collar)

  // Underside ribs and side runners that ride the fitment rails.
  for (const x of [-tw / 4, 0, tw / 4]) {
    const rib = new THREE.Mesh(cached(k('tub.rib'), () => new RoundedBoxGeometry(0.01, 0.01, depth - 0.04, 2, 0.003)), m.door)
    rib.position.set(x, -th / 2 - 0.005, zTubFront - depth / 2)
    tub.add(rib)
  }
  for (const side of [-1, 1]) {
    const runner = new THREE.Mesh(cached(k('tub.runner'), () => new RoundedBoxGeometry(0.01, 0.018, depth - 0.03, 2, 0.003)), m.door)
    runner.position.set(side * (tw / 2 + 0.002), -th / 2 + 0.012, zTubFront - depth / 2 - 0.01)
    tub.add(runner)
  }
  tub.position.y = -s.h / 2 + RAIL_H + th / 2

  const contents = buildContents(tw - 2 * wall, th - 2 * wall, depth - wall, m, 1)
  contents.position.set(0, tub.position.y, zTubFront)
  contents.userData = { fill: 1, box: { w: tw - 2 * wall, h: th - 2 * wall, d: depth - wall } }

  const door = buildDoor(cfg, s.w, s.h, m)
  group.add(tub, contents, door.pivot)
  group.position.set(s.x, s.y, zFront)
  return { group, door, spec, depth }
}
