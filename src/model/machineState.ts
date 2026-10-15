import type { Machine } from './buildMachine.ts'
import { setLightState } from './components/StatusLight.ts'

// Pose the machine: door swing, module pull-out and status lights. t runs 0 → 1.

const DOOR_OPEN = { side: (105 * Math.PI) / 180, drop: (95 * Math.PI) / 180 }
// At t = 1 the module is fully out of its slot, clear of the bezel, with the fitment exposed.
const PULL_CLEARANCE = 0.22

export function setDoorOpen(machine: Machine, slot: number, t: number) {
  const mod = machine.slots[slot]?.module
  if (!mod) return
  const { door } = mod
  const angle = DOOR_OPEN[door.style] * clamp01(t)
  if (door.openAxis === 'y') door.pivot.rotation.y = -angle
  else door.pivot.rotation.x = angle
  door.lock.bar.rotation.z = t > 0 ? Math.PI / 2 : 0
  setLightState(machine.slots[slot].light, t > 0 ? 'unlocked' : 'plugged')
}

export function setModulePulled(machine: Machine, slot: number, t: number) {
  const s = machine.slots[slot]
  if (!s?.module) return
  s.module.group.position.z = machine.layout.zFront + (s.module.depth + PULL_CLEARANCE) * clamp01(t)
}

// Take the module out of the machine entirely (mid-swap): the empty slot shows its fitment.
export function setModuleRemoved(machine: Machine, slot: number, removed: boolean) {
  const s = machine.slots[slot]
  if (!s?.module) return
  s.module.group.visible = !removed
  setLightState(s.light, removed ? 'none' : 'plugged')
}

export function resetMachine(machine: Machine) {
  for (const s of machine.slots) {
    if (!s.module) continue
    setDoorOpen(machine, s.rect.index, 0)
    setModulePulled(machine, s.rect.index, 0)
  }
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t))
}
