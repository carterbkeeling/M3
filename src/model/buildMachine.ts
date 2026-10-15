import * as THREE from 'three'
import type { MachineConfig, ModuleSpec } from './config.ts'
import { layout, outerDims, type Layout, type OuterDims, type SlotRect } from './dims.ts'
import { createMaterials, type MachineMaterials } from './materials.ts'
import { buildStrokePath, type StrokePath } from './strokePath.ts'
import { buildAccentStroke, type StrokeParts } from './components/AccentStroke.ts'
import { BEZEL_DEPTH, buildCabinet, type CabinetParts } from './components/Cabinet.ts'
import { buildFitment, type FitmentParts } from './components/Fitment.ts'
import { buildModule, type ModuleParts } from './components/Module.ts'
import { buildReader, type ReaderParts } from './components/Reader.ts'
import { buildSlotCavity } from './components/Slot.ts'
import { setLightState } from './components/StatusLight.ts'

// config → machine. Pure and DOM-free: no canvas, no document, no texture loads,
// so it runs (and is unit-tested) in Node. Placard text is applied later by placardAtlas.ts.

export interface PlacardDescriptor {
  slot: number
  product: string
  packed: string
}

export interface SlotParts {
  rect: SlotRect
  cavity: THREE.Mesh
  fitment: FitmentParts
  module: ModuleParts | null
  light: THREE.MeshStandardMaterial | undefined
}

export interface Machine {
  root: THREE.Group
  dims: OuterDims
  layout: Layout
  materials: MachineMaterials
  cabinet: CabinetParts
  reader: ReaderParts
  stroke: StrokeParts
  strokePath: StrokePath
  slots: SlotParts[]
  placards: PlacardDescriptor[]
}

export function buildMachine(cfg: MachineConfig): Machine {
  const L = layout(cfg)
  const materials = createMaterials(cfg.colorway)
  const root = new THREE.Group()
  root.name = 'm³'

  const cabinet = buildCabinet(cfg, L, materials)
  root.add(cabinet.group)

  const strokePath = buildStrokePath(cfg, L)
  const stroke = buildAccentStroke(cfg, strokePath, L.zFront, materials)
  root.add(stroke.group)

  const reader = buildReader(strokePath.reader.x, strokePath.reader.y, L.zFront, materials)
  root.add(reader.group)

  // Modules fill slots row-major; extras beyond the slot count are ignored.
  const specs: Array<ModuleSpec | undefined> = L.slots.map((_, i) => cfg.modules[i])
  const slots: SlotParts[] = L.slots.map((rect, i) => {
    const cavity = buildSlotCavity(rect, L.zFront - BEZEL_DEPTH, L.cavityBack, materials)
    const fitment = buildFitment(rect, L.zFront - BEZEL_DEPTH, L.cavityBack, materials)
    const spec = specs[i]
    const module = spec ? buildModule(cfg, rect, spec, L.zFront, L.cavityBack, materials) : null
    root.add(cavity, fitment.group)
    if (module) root.add(module.group)
    const light = stroke.lights.get(rect.index)
    setLightState(light, module ? 'plugged' : 'none')
    return { rect, cavity, fitment, module, light }
  })

  const placards: PlacardDescriptor[] = slots
    .filter((s) => s.module)
    .map((s) => ({ slot: s.rect.index, product: s.module!.spec.product, packed: s.module!.spec.packed }))

  return { root, dims: outerDims(cfg), layout: L, materials, cabinet, reader, stroke, strokePath, slots, placards }
}
