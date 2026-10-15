import * as THREE from 'three'
import type { MachineMaterials } from '../materials.ts'

// The access reader in the header: a nearly flush round tap pad with a thin indicator ring.
// No screen. The light-pipe loop around it is the main signal.

export interface ReaderParts {
  group: THREE.Group
  ring: THREE.Mesh
}

export function buildReader(x: number, y: number, zFront: number, m: MachineMaterials): ReaderParts {
  const group = new THREE.Group()
  group.name = 'Reader'
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.0025, 48).rotateX(Math.PI / 2), m.reader)
  pad.position.z = 0.00125
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0011, 8, 48), m.readerRing)
  ring.position.z = 0.0026
  ring.name = 'ReaderRing'
  group.add(pad, ring)
  group.position.set(x, y, zFront)
  return { group, ring }
}
