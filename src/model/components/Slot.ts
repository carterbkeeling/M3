import * as THREE from 'three'
import type { SlotRect } from '../dims.ts'
import type { MachineMaterials } from '../materials.ts'

// The molded cavity behind each slot opening: an open-fronted liner with a slight draft
// (the back is a little smaller than the opening, as a molded part would be).
export function buildSlotCavity(s: SlotRect, zFrontOfCavity: number, zBack: number, m: MachineMaterials, draftDeg = 0.5): THREE.Mesh {
  const depth = zFrontOfCavity - zBack
  const g = new THREE.BoxGeometry(s.w, s.h, depth, 1, 1, 1)
  const shrink = Math.tan((draftDeg * Math.PI) / 180) * depth
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    if (pos.getZ(i) < 0) {
      pos.setX(i, pos.getX(i) - Math.sign(pos.getX(i)) * shrink)
      pos.setY(i, pos.getY(i) - Math.sign(pos.getY(i)) * shrink)
    }
  }
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(g, m.interior) // interior material renders back faces only
  mesh.position.set(s.x, s.y, zBack + depth / 2)
  mesh.name = `Cavity ${s.index}`
  return mesh
}
