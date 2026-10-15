import type * as THREE from 'three'
import { pipeIntensity } from '../materials.ts'

// A slot's status light is its stretch of the accent stroke. Brightness carries the state;
// captions and aria text say it in words ("no module", "plugged in", "unlocked").

export type LightState = 'none' | 'plugged' | 'unlocked'

export function setLightState(mat: THREE.MeshStandardMaterial | undefined, state: LightState) {
  if (!mat) return
  mat.emissiveIntensity = pipeIntensity[state]
}
