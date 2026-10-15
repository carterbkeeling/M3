// ★ The one file that defines the m³ machine.
// Units are meters, at true scale. Editing this file alone changes the model:
// dimensions, slot grid, door style, colorway, accent-stroke path and the module list (placards).

export type DoorStyle = 'side' | 'drop'
export type StrokePathKind = 'spine' | 'serpentine'
export type ColorwayId = 'graphiteMatte' | 'carbonSatin' | 'charcoalTwoTone'

export interface ModuleSpec {
  product: string
  packed: string
}

export interface Colorway {
  name: string
  body: string
  door: string
  interior: string
  fitment: string
  placardHolder: string
  placardInsert: string
  bodyRoughness: number
  doorRoughness: number
}

export interface MachineConfig {
  radius: { edge: number; inner: number; corner: number }
  wall: number
  slot: { w: number; h: number; d: number }
  grid: { cols: number; rows: number }
  cabinet: {
    header: number
    plinth: number
    mullion: number
    side: number
    rail: number
    back: number
    front: number
  }
  door: { style: DoorStyle; hinge: 'left'; gap: number; thickness: number }
  colorway: ColorwayId
  stroke: { path: StrokePathKind; width: number; turnRadius: number }
  modules: ModuleSpec[]
}

// Pipe Cyan: m³'s accent. The light pipe is the same color in every colorway.
export const accent = { pipe: '#12D6FF' }

// Dark machine only (decision 6). No body or door surface is lighter than about #45464B.
export const colorways: Record<ColorwayId, Colorway> = {
  graphiteMatte: {
    name: 'Graphite Matte',
    body: '#2A2C31',
    door: '#34363C',
    interior: '#2B2D33',
    fitment: '#565961',
    placardHolder: '#2E3035',
    placardInsert: '#F3EFE7',
    bodyRoughness: 0.82,
    doorRoughness: 0.78,
  },
  carbonSatin: {
    name: 'Carbon Satin',
    body: '#17181B',
    door: '#1E1F23',
    interior: '#202125',
    fitment: '#4E5157',
    placardHolder: '#1A1B1E',
    placardInsert: '#F3EFE7',
    bodyRoughness: 0.6,
    doorRoughness: 0.45,
  },
  charcoalTwoTone: {
    name: 'Charcoal Two-Tone',
    body: '#232428',
    door: '#3A3632',
    interior: '#28292D',
    fitment: '#57585E',
    placardHolder: '#2A2B2F',
    placardInsert: '#F3EFE7',
    bodyRoughness: 0.8,
    doorRoughness: 0.7,
  },
}

export const config: MachineConfig = {
  radius: { edge: 0.012, inner: 0.009, corner: 0.024 },
  wall: 0.004, // uniform wall thickness
  slot: { w: 0.41, h: 0.243, d: 0.78 }, // opening size, fixed by the universal fitment
  grid: { cols: 2, rows: 6 },
  // rail = row divider; mullion carries the light-pipe spine; back = rear wall + ribs/connector cavity;
  // front = door + pull proud of the bezel. Defaults give 0.99 × 1.828 × 0.89 m (≈ 39 × 72 × 35 in).
  cabinet: { header: 0.17, plinth: 0.1, mullion: 0.07, side: 0.05, rail: 0.02, back: 0.07, front: 0.04 },
  door: { style: 'side', hinge: 'left', gap: 0.003, thickness: 0.024 }, // 'side' | 'drop'; approved at Phase 1
  colorway: 'graphiteMatte',
  stroke: { path: 'spine', width: 0.008, turnRadius: 0.012 },
  // Modules fill slots row-major from the top left. Extras beyond cols×rows are ignored;
  // unfilled slots render empty (fitment visible, light segment dim).
  // Example modules: quantities are illustrative placeholders (listed in COPY-REVIEW).
  modules: [
    { product: 'Nitrile gloves', packed: '100 pairs' },
    { product: 'Cut-resistant gloves', packed: '24 pairs' },
    { product: 'Safety glasses', packed: '36' },
    { product: 'Foam earplugs', packed: '200 pairs' },
    { product: 'N95 respirators', packed: '40' },
    { product: 'Hi-vis vests', packed: '12' },
    { product: 'AA batteries', packed: '96' },
    { product: 'Zip ties', packed: '500' },
    { product: 'Utility blades', packed: '100' },
    { product: 'Electrical tape', packed: '30 rolls' },
    { product: 'Lens wipes', packed: '300' },
    { product: 'First-aid refills', packed: '20 kits' },
  ],
}
