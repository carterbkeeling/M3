import * as THREE from 'three'
import type { MachineConfig } from '../config.ts'
import type { MachineMaterials } from '../materials.ts'
import { cached, keyOf } from '../geometryCache.ts'
import { roundedSlab } from '../shapes.ts'
import { buildLock, type LockParts } from './Lock.ts'
import { buildPlacard, type PlacardParts } from './Placard.ts'

// The module's door, nearly flush with the bezel. All grips are molded into the door itself.
// Style 'side': hinged on the left (molded knuckles tucked inside the door outline) with a
// vertical stadium-shaped finger pocket at the free edge.
// Style 'drop': hinged along the bottom with a full-width recessed pull lip along the top edge.
// The latch sits on the inner face: hidden when closed, visible when the door is open.

export interface DoorParts {
  pivot: THREE.Group // rotate this to open
  style: 'side' | 'drop'
  placard: PlacardParts
  lock: LockParts
  openAxis: 'y' | 'x'
}

export const DOOR_FRONT = 0.006 // door face sits this far proud of the bezel; the rest is recessed
export const KNUCKLE_R = 0.0075

export function buildDoor(cfg: MachineConfig, slotW: number, slotH: number, m: MachineMaterials): DoorParts {
  const { gap, thickness: t, style } = cfg.door
  const dw = slotW - 2 * gap
  const dh = slotH - 2 * gap
  const r = cfg.radius.inner - gap // concentric with the R9 opening, so the gap stays even
  const b = 0.005

  const pivot = new THREE.Group()
  pivot.name = 'DoorPivot'
  const leaf = new THREE.Group()
  leaf.name = 'Door'
  // Every door is the same size, so all of them share these geometries.
  const k = (name: string) => keyOf(name, dw, dh, t, r, b)
  const knuckle = cached('door.knuckle', () => new THREE.CylinderGeometry(KNUCKLE_R, KNUCKLE_R, 0.036, 16))
  const placard = buildPlacard(style === 'side' ? Math.min(0.24, dw - 0.15) : Math.min(0.26, dw - 0.1), 0.085, m)
  const lock = buildLock(m)

  if (style === 'side') {
    pivot.position.set(-dw / 2, 0, DOOR_FRONT)
    leaf.position.set(dw / 2, 0, 0)
    // Finger pocket: a stadium cut through the face skin with a recessed floor behind it.
    const pocket = { w: 0.026, h: 0.13, r: 0.013, cx: dw / 2 - 0.036, cy: 0 }
    const slab = new THREE.Mesh(cached(k('door.side.slab'), () => roundedSlab(dw, dh, t, r, b, [pocket])), m.door)
    slab.position.z = -t
    const floor = new THREE.Mesh(cached('door.side.pocket', () => roundedSlab(pocket.w + 0.01, pocket.h + 0.01, 0.006, pocket.r + 0.005, 0.002)), m.door)
    floor.position.set(pocket.cx, pocket.cy, -0.014)
    leaf.add(slab, floor)
    for (const y of [dh / 2 - 0.04, -dh / 2 + 0.04]) {
      const k = new THREE.Mesh(knuckle, m.door)
      k.position.set(-dw / 2 + KNUCKLE_R, y, -0.004)
      leaf.add(k)
    }
    placard.group.position.set(-0.03, 0, 0)
    // Latch on the inner face near the free edge, tongue pointing into the tub collar.
    lock.group.position.set(dw / 2 - 0.02, 0, -t - 0.002)
  } else {
    pivot.position.set(0, -dh / 2, DOOR_FRONT)
    leaf.position.set(0, dh / 2, 0)
    // Full-width recessed lip: the top strip of the door steps back 12 mm.
    const lipH = 0.026
    const lipD = 0.012
    const body = new THREE.Mesh(cached(k('door.drop.body'), () => roundedSlab(dw, dh - lipH, t, r, b)), m.door)
    body.position.set(0, -lipH / 2, -t)
    const lip = new THREE.Mesh(cached(k('door.drop.lip'), () => roundedSlab(dw, lipH + r, t - lipD, r, b)), m.door)
    lip.position.set(0, dh / 2 - (lipH + r) / 2, -t)
    leaf.add(body, lip)
    for (const x of [dw / 2 - 0.06, -dw / 2 + 0.06]) {
      const k = new THREE.Mesh(knuckle, m.door)
      k.rotation.z = Math.PI / 2
      k.position.set(x, -dh / 2 + KNUCKLE_R, -0.004)
      leaf.add(k)
    }
    placard.group.position.set(0, -0.028, 0)
    lock.group.position.set(0, dh / 2 - 0.03, -t - 0.002)
  }
  lock.group.rotation.y = Math.PI // faces into the module
  leaf.add(placard.group, lock.group)
  pivot.add(leaf)
  return { pivot, style, placard, lock, openAxis: style === 'side' ? 'y' : 'x' }
}
