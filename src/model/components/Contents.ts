import * as THREE from 'three'
import type { MachineMaterials } from '../materials.ts'

// Generic packed contents: neutral cartons stacked inside the module. `fill` 1 = full as packed;
// lower values show a returned, part-used module (only ever shown at the warehouse, never on site).

let carton: THREE.BufferGeometry | null = null

export function buildContents(innerW: number, innerH: number, innerD: number, m: MachineMaterials, fill = 1): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Contents'
  const nx = 3
  const ny = 2
  const nz = 5
  const cw = (innerW - 0.02) / nx
  const ch = (innerH - 0.02) / ny
  const cd = (innerD - 0.03) / nz
  carton ??= new THREE.BoxGeometry(1, 1, 1)
  const total = nx * ny * nz
  const keep = Math.round(total * Math.max(0, Math.min(1, fill)))
  // Packed in a staircase from the back and the floor, so a partly used module has been emptied
  // from the front (door side) and the top first, the way it is picked: its open front shows bare
  // floor ahead of the stock that is left. iz counts layers from the back, iy rows from the floor;
  // the top row trails the bottom by two layers.
  const slots: Array<[ix: number, iy: number, iz: number]> = []
  for (let iz = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) slots.push([ix, iy, iz])
  slots.sort((a, b) => a[2] + 2 * a[1] - (b[2] + 2 * b[1]) || a[1] - b[1])
  for (const [ix, iy, iz] of slots.slice(0, keep)) {
    const box = new THREE.Mesh(carton, m.carton)
    box.scale.set(cw - 0.006, ch - 0.006, cd - 0.006)
    box.position.set(-innerW / 2 + 0.01 + cw * (ix + 0.5), -innerH / 2 + 0.01 + ch * (iy + 0.5), -innerD + 0.015 + cd * (iz + 0.5))
    group.add(box)
  }
  return group
}
