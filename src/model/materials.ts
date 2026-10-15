import * as THREE from 'three'
import { accent, colorways, type ColorwayId } from './config.ts'

// Phase 1 blockout materials: flat, untextured molded-plastic stand-ins.
// Physical materials, the noise normal and satin edge highlights arrive in Phase 3.

export interface MachineMaterials {
  body: THREE.MeshStandardMaterial
  interior: THREE.MeshStandardMaterial
  door: THREE.MeshStandardMaterial
  fitment: THREE.MeshStandardMaterial
  connector: THREE.MeshStandardMaterial
  placardHolder: THREE.MeshStandardMaterial
  placardInsert: THREE.MeshStandardMaterial
  lock: THREE.MeshStandardMaterial
  feet: THREE.MeshStandardMaterial
  reader: THREE.MeshStandardMaterial
  readerRing: THREE.MeshStandardMaterial
  carton: THREE.MeshStandardMaterial
  pipeConnector: THREE.MeshStandardMaterial
  pipeSegment: () => THREE.MeshStandardMaterial // one per slot, so each light can change on its own
}

export const pipeIntensity = { none: 0.07, plugged: 0.75, unlocked: 1.6, connector: 0.4, reader: 0.9 }

export function createMaterials(id: ColorwayId): MachineMaterials {
  const c = colorways[id]
  const std = (color: string, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra })
  // Brightness comes only from the emissive term, so the light states read apart.
  const pipe = (intensity: number) =>
    std('#06090B', 0.35, { emissive: new THREE.Color(accent.pipe), emissiveIntensity: intensity })

  return {
    body: std(c.body, c.bodyRoughness),
    interior: std(c.interior, 0.9, { side: THREE.BackSide }),
    door: std(c.door, c.doorRoughness),
    fitment: std(c.fitment, 0.6),
    connector: std('#6E727B', 0.45),
    placardHolder: std(c.placardHolder, c.doorRoughness),
    placardInsert: std(c.placardInsert, 0.92),
    lock: std('#55585F', 0.55),
    feet: std('#111214', 0.95),
    reader: std('#1C1D21', 0.55),
    readerRing: pipe(pipeIntensity.reader), // the light ring around the reader; pulses on a tap
    carton: std('#8A8378', 0.95),
    pipeConnector: pipe(pipeIntensity.connector),
    pipeSegment: () => pipe(pipeIntensity.plugged),
  }
}
