import * as THREE from 'three'
import type { MachineMaterials } from '../materials.ts'
import { roundedSlab } from '../shapes.ts'
import type { ReaderPlacement } from '../strokePath.ts'

// The access reader: a nearly flush tap pad. No screen. On the spine it is a capsule set in the
// middle of the light pipe, ringed by its own light; on the serpentine variant it is a round pad
// in the header that the stroke loops around.

export interface ReaderParts {
  group: THREE.Group
  pad: THREE.Mesh
}

export function buildReader(p: ReaderPlacement, zFront: number, m: MachineMaterials): ReaderParts {
  const group = new THREE.Group()
  group.name = 'Reader'
  let pad: THREE.Mesh
  if (p.kind === 'capsule') {
    const w = 2 * p.padR
    pad = new THREE.Mesh(roundedSlab(w, w + p.straight, 0.006, p.padR, 0.0015), m.reader)
    pad.position.z = 0
  } else {
    pad = new THREE.Mesh(new THREE.CylinderGeometry(p.padR, p.padR, 0.006, 48).rotateX(Math.PI / 2), m.reader)
    pad.position.z = 0.003
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.padR * 0.72, 0.0011, 8, 48), m.lock)
    ring.position.z = 0.0062
    group.add(ring)
  }
  pad.name = 'ReaderPad'
  group.add(pad)
  group.position.set(p.x, p.y, zFront)
  return { group, pad }
}
