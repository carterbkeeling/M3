import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { MachineMaterials } from '../materials.ts'
import { cached, keyOf } from '../geometryCache.ts'
import { roundedSlab } from '../shapes.ts'

// A molded placard holder on the door with a printed insert. The holder is a thin backing plate
// with a raised rim; the insert slides in under the rim's lip, so its edges are hidden and the
// visible window has rounded corners. The insert is blank as built (buildMachine stays DOM-free);
// placardAtlas.ts draws the text (name + "Packed: N") and points the insert at its atlas region.

export interface PlacardParts {
  group: THREE.Group
  holder: THREE.Mesh
  insert: THREE.Mesh // its own PlaneGeometry, so its UVs can address its atlas cell
}

export const PLACARD_RIM = 0.006 // rim width around the visible window
export const PLACARD_LIP = 0.001 // how far the insert runs under the rim on each side
const PLATE_T = 0.0025
const RIM_T = 0.0045
const WINDOW_R = 0.004

export function buildPlacard(w: number, h: number, m: MachineMaterials): PlacardParts {
  const group = new THREE.Group()
  group.name = 'Placard'
  const win = { w: w - 2 * PLACARD_RIM, h: h - 2 * PLACARD_RIM }

  // Backing plate + raised rim, merged: one mesh, one draw call.
  // Every placard holder is the same size, so all of them share one geometry.
  const holderGeo = cached(keyOf('placard.holder', w, h), () => {
    const plate = roundedSlab(w, h, PLATE_T, 0.008, 0.001)
    const rim = roundedSlab(w, h, RIM_T, 0.008, 0.0012, [{ w: win.w, h: win.h, r: WINDOW_R, cx: 0, cy: 0 }])
    return mergeGeometries([plate, rim]) ?? plate
  })
  const holder = new THREE.Mesh(holderGeo, m.placardHolder)
  holder.name = 'PlacardHolder'

  // The printed insert: sits on the plate, behind the rim's front face.
  const iw = win.w + 2 * PLACARD_LIP
  const ih = win.h + 2 * PLACARD_LIP
  const insert = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), m.placardInsert)
  insert.position.z = PLATE_T + 0.0002
  insert.name = 'PlacardInsert'
  // Physical size of the insert and of its visible window (meters), for the atlas layout.
  insert.userData.placard = { w: iw, h: ih, windowW: win.w, windowH: win.h }
  group.add(holder, insert)
  return { group, holder, insert }
}
