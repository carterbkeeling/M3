import * as THREE from 'three'
import type { MachineMaterials } from '../materials.ts'
import { roundedSlab } from '../shapes.ts'

// A molded placard holder on the door with a printed insert. The insert is blank in the
// blockout; in Phase 3 it takes its region of the placard atlas (name + "Packed: N").

export interface PlacardParts {
  group: THREE.Group
  insert: THREE.Mesh
}

export function buildPlacard(w: number, h: number, m: MachineMaterials): PlacardParts {
  const group = new THREE.Group()
  group.name = 'Placard'
  const holder = new THREE.Mesh(roundedSlab(w, h, 0.004, 0.008, 0.0015), m.placardHolder)
  const insert = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.014, h - 0.014), m.placardInsert)
  insert.position.z = 0.0042
  insert.name = 'PlacardInsert'
  group.add(holder, insert)
  return { group, insert }
}
