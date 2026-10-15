import * as THREE from 'three'
import type { Machine } from '../model/buildMachine.ts'
import { accent } from '../model/config.ts'
import { pipeIntensity } from '../model/materials.ts'
import { setContentsFill, setDoorOpen, setModulePulled } from '../model/machineState.ts'
import { setLightState } from '../model/components/StatusLight.ts'

// Scroll-driven scenes (Phase 2: roughed in). Each scene poses the machine for a progress value
// p in 0–1 through its sticky section, and returns to rest at both ends so leaving a section never
// leaves a door open. Scene letters follow the brief: (d) swap, (c) exploded, (b) unlock.

const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))
const ease = (t: number) => t * t * (3 - 2 * t)

export interface Scene {
  apply(p: number): void
  /** Optional camera nudge while the scene plays: [extra dist, extra lookY]. */
  camera?(p: number): [number, number]
}

// (d) The swap: How it works. Load (at the warehouse, a module alone is filled and closed) →
// Swap (on site: used out, full in, light on) → Count (at the warehouse, the returned module is
// opened). The on-site machine never shows a count; consumption only appears at the warehouse.
export function swapScene(m: Machine, slot: number): Scene {
  const module = m.slots[slot].module!.group
  const everythingElse = m.root.children.filter((o) => o !== module)
  return {
    apply(p) {
      // At the warehouse (Load, Count) the module is shown on its own: the machine is not on stage.
      const atWarehouse = (p > 0.04 && p < 0.3) || (p > 0.74 && p < 0.94)
      for (const o of everythingElse) o.visible = !atWarehouse
      const load = ease(seg(p, 0.04, 0.1)) * (1 - ease(seg(p, 0.26, 0.32))) // pulled clear and opened
      const fill = ease(seg(p, 0.08, 0.24))
      const out = ease(seg(p, 0.34, 0.46)) // used module slides out
      const back = ease(seg(p, 0.5, 0.62)) // full module slides in
      const count = ease(seg(p, 0.7, 0.8)) // at the warehouse: pulled clear, opened
      const rest = ease(seg(p, 0.92, 1)) // tidy up before the next section
      const pulled = Math.max(0, out - back) + count * (1 - rest) + load
      setModulePulled(m, slot, pulled)
      setDoorOpen(m, slot, Math.max(load * (1 - ease(seg(p, 0.22, 0.26))), count * (1 - rest)))
      setContentsFill(m, slot, p < 0.32 ? Math.round(fill * 10) / 10 : p >= 0.7 && p < 0.96 ? 0.35 : 1)
      const dark = load > 0.02 || (out > 0.02 && back < 0.98) || (count > 0.02 && rest < 0.98)
      setLightState(m.slots[slot].light, dark ? 'none' : 'plugged')
    },
    camera(p) {
      const near = ease(seg(p, 0.02, 0.2)) * (1 - ease(seg(p, 0.9, 1)))
      return [-0.1 * near, 0]
    },
  }
}

// (c) Exploded view: Modular by design. A module slides out, its fitment is highlighted (an
// illustration, not a product light), the body separates into its parts, then goes back together.
export function explodedScene(m: Machine, slot: number): Scene {
  const fit = m.slots[slot].fitment.group
  const highlight = new THREE.MeshStandardMaterial({
    color: '#0A2A33',
    roughness: 0.5,
    emissive: new THREE.Color(accent.pipe),
    emissiveIntensity: 0,
  })
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  fit.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) originals.set(mesh, mesh.material)
  })
  const { bezel, back, plinth, skin } = m.cabinet
  const front = [bezel, m.reader.group, m.stroke.group]
  const base = { z: 0, y: 0 }
  return {
    apply(p) {
      const out = ease(seg(p, 0.05, 0.3))
      const lit = ease(seg(p, 0.28, 0.4)) * (1 - ease(seg(p, 0.85, 0.95)))
      const apart = ease(seg(p, 0.42, 0.66)) * (1 - ease(seg(p, 0.78, 0.92)))
      const home = ease(seg(p, 0.86, 1))
      setModulePulled(m, slot, out * (1 - home))
      setLightState(m.slots[slot].light, out > 0.02 && home < 0.98 ? 'none' : 'plugged')
      highlight.emissiveIntensity = 1.4 * lit
      fit.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) mesh.material = lit > 0.01 ? highlight : originals.get(mesh)!
      })
      for (const o of front) o.position.z = base.z + 0.22 * apart
      back.position.z = -0.22 * apart
      plinth.position.y = -0.12 * apart
      skin.position.y = 0.06 * apart
    },
    camera(p) {
      const wide = ease(seg(p, 0.4, 0.6)) * (1 - ease(seg(p, 0.8, 0.95)))
      return [0.8 * wide, 0]
    },
  }
}

// (b) Unlock: Connected, not counting. A tap at the reader, the ring pulses, the slot's light
// brightens, and its door swings open on its product; then it closes again.
export function unlockScene(m: Machine, slot: number): Scene {
  const ring = m.materials.readerRing
  return {
    apply(p) {
      const tap = seg(p, 0.12, 0.3)
      const pulse = Math.sin(Math.PI * tap)
      ring.emissiveIntensity = pipeIntensity.reader + 1.6 * pulse
      const unlocked = p > 0.28 && p < 0.92
      const open = ease(seg(p, 0.36, 0.6)) * (1 - ease(seg(p, 0.82, 0.94)))
      setDoorOpen(m, slot, open)
      if (!unlocked && open < 0.01) setLightState(m.slots[slot].light, 'plugged')
      else setLightState(m.slots[slot].light, 'unlocked')
    },
  }
}
