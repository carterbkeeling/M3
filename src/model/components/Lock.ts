import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { MachineMaterials } from '../materials.ts'

// The module's latch: a small molded tongue on the inside of the door. Nothing on the outer face
// suggests a key; access is by tap at the reader, and the slot's light shows the state.
// On unlock the tongue turns a quarter (visible whenever the door is open).

export interface LockParts {
  group: THREE.Group
  bar: THREE.Mesh
}

export function buildLock(m: MachineMaterials): LockParts {
  const group = new THREE.Group()
  group.name = 'Latch'
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 24).rotateX(Math.PI / 2), m.lock)
  boss.position.z = 0.002
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.008, 0.006, 2, 0.0025), m.lock)
  bar.position.z = 0.006
  bar.name = 'LatchTongue'
  group.add(boss, bar)
  return { group, bar }
}
