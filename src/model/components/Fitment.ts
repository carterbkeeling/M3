import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { SlotRect } from '../dims.ts'
import type { MachineMaterials } from '../materials.ts'

// The universal fitment: identical in every slot. Two L-rails with snap-fit tabs near the front,
// and a low-voltage connector block at the rear. Geometry is shared across all slots.

export const RAIL_H = 0.012

let shared: { rail: THREE.BufferGeometry; lip: THREE.BufferGeometry; tab: THREE.BufferGeometry; block: THREE.BufferGeometry; pin: THREE.BufferGeometry; len: number } | null = null

function geometries(len: number) {
  if (shared && shared.len === len) return shared
  shared = {
    len,
    rail: new RoundedBoxGeometry(0.018, RAIL_H, len, 2, 0.003),
    lip: new RoundedBoxGeometry(0.004, 0.026, len, 2, 0.0015),
    tab: new RoundedBoxGeometry(0.012, 0.006, 0.022, 2, 0.002),
    block: new RoundedBoxGeometry(0.084, 0.04, 0.03, 2, 0.006),
    pin: new THREE.CylinderGeometry(0.0025, 0.0025, 0.01, 10).rotateX(Math.PI / 2),
  }
  return shared
}

export interface FitmentParts {
  group: THREE.Group
  connector: THREE.Mesh
}

export function buildFitment(s: SlotRect, zFront: number, zBack: number, m: MachineMaterials): FitmentParts {
  const len = zFront - zBack - 0.05
  const g = geometries(len)
  const group = new THREE.Group()
  group.name = `Fitment ${s.index}`
  const zc = zBack + 0.035 + len / 2
  for (const side of [-1, 1]) {
    const x = side * (s.w / 2 - 0.011)
    const rail = new THREE.Mesh(g.rail, m.fitment)
    rail.position.set(x, -s.h / 2 + RAIL_H / 2, zc)
    const lip = new THREE.Mesh(g.lip, m.fitment)
    lip.position.set(side * (s.w / 2 - 0.002), -s.h / 2 + 0.013, zc)
    const tab = new THREE.Mesh(g.tab, m.connector)
    tab.position.set(x, -s.h / 2 + RAIL_H + 0.003, zFront - 0.06)
    group.add(rail, lip, tab)
  }
  const connector = new THREE.Mesh(g.block, m.connector)
  connector.position.set(0, -s.h / 2 + 0.035, zBack + 0.015)
  connector.name = 'Connector'
  group.add(connector)
  for (const px of [-0.02, 0, 0.02]) {
    const pin = new THREE.Mesh(g.pin, m.fitment)
    pin.position.set(px, -s.h / 2 + 0.035, zBack + 0.034)
    group.add(pin)
  }
  group.position.set(s.x, s.y, 0)
  return { group, connector }
}
