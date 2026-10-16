import type { Machine } from './buildMachine.ts'
import { buildContents } from './components/Contents.ts'
import { setLightState } from './components/StatusLight.ts'

// Pose the machine: door swing, module pull-out and status lights. t runs 0 → 1.

const DOOR_OPEN = { side: (105 * Math.PI) / 180, drop: (95 * Math.PI) / 180 }
// At t = 1 the module is fully out of its slot, clear of the bezel, with the fitment exposed.
const PULL_CLEARANCE = 0.22
// Exploded view: once out, the module lifts above its opening and comes a little further forward,
// so it no longer hides the empty slot's fitment and connector (and stays clear of the bezel as
// that moves forward).
const SET_ASIDE = { up: 0.3, out: 0.14 }

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

// aside (0 → 1) moves a fully pulled module up and out of the way of its slot; 0 keeps it on its rails.
export function setModulePulled(machine: Machine, slot: number, t: number, aside = 0) {
  const s = machine.slots[slot]
  if (!s?.module) return
  const a = clamp01(aside)
  const z = machine.layout.zFront + (s.module.depth + PULL_CLEARANCE) * clamp01(t) + SET_ASIDE.out * a
  s.module.group.position.set(s.rect.x, s.rect.y + SET_ASIDE.up * a, z)
}

// Take the module out of the machine entirely (mid-swap): the empty slot shows its fitment.
export function setModuleRemoved(machine: Machine, slot: number, removed: boolean) {
  const s = machine.slots[slot]
  if (!s?.module) return
  s.module.group.visible = !removed
  setLightState(s.light, removed ? 'none' : 'plugged')
}

// Show a module as packed (1) or as returned (lower): only ever staged at the warehouse.
export function setContentsFill(machine: Machine, slot: number, fill: number) {
  const mod = machine.slots[slot]?.module
  if (!mod) return
  const old = mod.group.getObjectByName('Contents')
  if (!old || old.userData.fill === fill) return
  const box = old.userData.box as { w: number; h: number; d: number } | undefined
  if (!box) return
  const next = buildContents(box.w, box.h, box.d, machine.materials, fill)
  next.position.copy(old.position)
  next.userData = { fill, box }
  old.removeFromParent()
  mod.group.add(next)
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
