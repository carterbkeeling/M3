import * as THREE from 'three'
import type { Machine } from '../model/buildMachine.ts'
import { accent } from '../model/config.ts'
import { pipeIntensity } from '../model/materials.ts'
import { setContentsFill, setDoorOpen, setModulePulled } from '../model/machineState.ts'
import { setLightState } from '../model/components/StatusLight.ts'
import { buildBadge } from '../model/components/Badge.ts'

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
      // Full well before the door closes, so the Load beat holds on a packed module and reads apart
      // from the part-used one at Count.
      const fill = ease(seg(p, 0.07, 0.15))
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

// (c) Exploded view: Modular by design. A module slides out and lifts clear of its opening, the
// machine turns toward the camera while the empty slot's fitment is highlighted (an illustration,
// not a product light), then turns back as the body separates into its parts, and everything goes
// back together. The beats are complete by p 0.3 and 0.6, where reduced motion holds them.
// The turn (rad) takes the section's three-quarter yaw of 0.5 most of the way to face-on.
const FACE_TURN = 0.36
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
      const out = ease(seg(p, 0.04, 0.18))
      // Set aside once its back is past the bezel, so the lit fitment and connector stay in view.
      const aside = ease(seg(p, 0.16, 0.28)) * (1 - ease(seg(p, 0.82, 0.9)))
      const lit = ease(seg(p, 0.2, 0.3)) * (1 - ease(seg(p, 0.85, 0.95)))
      // Nearly face-on while the slot is lit: at the three-quarter view the slot's walls hide the
      // connector at its back. The separation reads best from the side, so it turns back first.
      const face = ease(seg(p, 0.18, 0.3)) * (1 - ease(seg(p, 0.36, 0.44)))
      const apart = ease(seg(p, 0.42, 0.66)) * (1 - ease(seg(p, 0.76, 0.88)))
      const home = ease(seg(p, 0.88, 1))
      m.root.rotation.y = -FACE_TURN * face
      setModulePulled(m, slot, out * (1 - home), aside)
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

// (b) Unlock: Connected, not counting. A badge comes up to the reader and taps it, the ring pulses,
// the slot's light brightens, and its door swings open on its product; then it closes again.
export function unlockScene(m: Machine, slot: number): Scene {
  const ring = m.materials.readerRing
  // The badge is this scene's prop, added beside the machine (never part of it). It stays visible
  // until the first apply() so the stage's up-front shader compile covers its material.
  const badge = buildBadge()
  m.root.add(badge.group)
  const { x, y, z } = m.reader.group.position
  // On the pad (its face is 6 mm proud of the reader's origin), held landscape and tilted the way a
  // hand holds it, so the lit ring shows above and below the card. (Upright and centered, ring arc
  // over a pale block, it read as a padlock.) And where the hand holds it before and after.
  const touch = { pos: new THREE.Vector3(x + 0.006, y + 0.004, z + 0.0065), rot: new THREE.Euler(0, 0, Math.PI / 2 - 0.26) }
  const away = { pos: new THREE.Vector3(x + 0.08, y - 0.12, z + 0.3), rot: new THREE.Euler(-0.4, 0.35, Math.PI / 2 - 0.7) }
  let ringOwned = false
  return {
    apply(p) {
      // Badge: comes in (0.04–0.14), rests on the pad through the pulse, goes again (0.24–0.32).
      const near = ease(seg(p, 0.04, 0.14)) * (1 - ease(seg(p, 0.24, 0.32)))
      badge.group.visible = near > 0.001
      if (badge.group.visible) {
        // Across first, then straight in, so it lands flat on the pad instead of sliding over it.
        const across = 1 - (1 - near) ** 2
        const g = badge.group
        g.position.set(
          THREE.MathUtils.lerp(away.pos.x, touch.pos.x, across),
          THREE.MathUtils.lerp(away.pos.y, touch.pos.y, across),
          THREE.MathUtils.lerp(away.pos.z, touch.pos.z, near),
        )
        g.rotation.set(
          THREE.MathUtils.lerp(away.rot.x, touch.rot.x, across),
          THREE.MathUtils.lerp(away.rot.y, touch.rot.y, across),
          THREE.MathUtils.lerp(away.rot.z, touch.rot.z, across),
        )
        badge.setOpacity(Math.min(1, near * 4))
      }
      // The ring belongs to this scene only while the section plays (the pulse rides on the badge's
      // touch); outside it the free views' unlock pulses it (interaction.ts), so hand it back once.
      if (p > 0 && p < 1) {
        ring.emissiveIntensity = pipeIntensity.reader + 1.6 * Math.sin(Math.PI * seg(p, 0.14, 0.3))
        ringOwned = true
      } else if (ringOwned) {
        ring.emissiveIntensity = pipeIntensity.reader
        ringOwned = false
      }
      const unlocked = p > 0.28 && p < 0.92
      const open = ease(seg(p, 0.36, 0.6)) * (1 - ease(seg(p, 0.82, 0.94)))
      setDoorOpen(m, slot, open)
      if (!unlocked && open < 0.01) setLightState(m.slots[slot].light, 'plugged')
      else setLightState(m.slots[slot].light, 'unlocked')
    },
  }
}
