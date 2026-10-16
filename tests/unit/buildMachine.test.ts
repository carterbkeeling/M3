import { describe, expect, it } from 'vitest'
import { config, type MachineConfig, type StrokePathKind } from '../../src/model/config.ts'
import { buildMachine, type Machine } from '../../src/model/buildMachine.ts'
import { layout, outerDims } from '../../src/model/dims.ts'
import { setContentsFill } from '../../src/model/machineState.ts'
import { pipeIntensity } from '../../src/model/materials.ts'
import { buildStrokePath } from '../../src/model/strokePath.ts'
import { explodedScene, swapScene, unlockScene } from '../../src/scene/scenes.ts'

const variant = (patch: Partial<MachineConfig>): MachineConfig => ({ ...structuredClone(config), ...patch })

describe('outerDims', () => {
  it('default 2×6 config is ≈ 0.99 × 1.83 × 0.89 m (≈ 39 × 72 × 35 in)', () => {
    const { W, H, D } = outerDims(config)
    expect(Math.abs(W - 0.99)).toBeLessThan(0.005)
    expect(Math.abs(H - 1.83)).toBeLessThan(0.005)
    expect(Math.abs(D - 0.89)).toBeLessThan(0.005)
    expect(Math.round(H / 0.0254)).toBe(72)
    expect(Math.round(W / 0.0254)).toBe(39)
    expect(Math.round(D / 0.0254)).toBe(35)
  })

  it('grows with the grid', () => {
    const a = outerDims(config)
    const b = outerDims(variant({ grid: { cols: 3, rows: 4 } }))
    expect(b.W).toBeGreaterThan(a.W)
    expect(b.H).toBeLessThan(a.H)
  })
})

const grids = [
  { cols: 2, rows: 6 },
  { cols: 3, rows: 4 },
  { cols: 1, rows: 8 },
  { cols: 4, rows: 3 },
]
const paths: StrokePathKind[] = ['spine', 'serpentine']

describe('accent stroke', () => {
  for (const grid of grids) {
    for (const path of paths) {
      it(`${path} on ${grid.cols}×${grid.rows}: exactly one light segment per slot`, () => {
        const cfg = variant({ grid, stroke: { ...config.stroke, path } })
        const L = layout(cfg)
        const sp = buildStrokePath(cfg, L)
        const owned = sp.pieces.filter((p) => p.slot !== null).map((p) => p.slot)
        expect(owned.length).toBe(grid.cols * grid.rows)
        expect(new Set(owned).size).toBe(grid.cols * grid.rows)
      })

      it(`${path} on ${grid.cols}×${grid.rows}: one continuous stroke`, () => {
        const cfg = variant({ grid, stroke: { ...config.stroke, path } })
        const sp = buildStrokePath(cfg, layout(cfg))
        for (let i = 1; i < sp.pieces.length; i++) {
          const prev = sp.pieces[i - 1].points.at(-1)!
          const next = sp.pieces[i].points[0]
          expect(Math.hypot(prev[0] - next[0], prev[1] - next[1])).toBeLessThan(1e-6)
        }
      })

      it(`${path} on ${grid.cols}×${grid.rows}: each segment stays beside its own slot`, () => {
        const cfg = variant({ grid, stroke: { ...config.stroke, path } })
        const L = layout(cfg)
        const sp = buildStrokePath(cfg, L)
        for (const piece of sp.pieces) {
          if (piece.slot === null) continue
          const s = L.slots[piece.slot]
          // nearest slot (by distance from the segment's midpoint to slot rectangles) must be its owner
          const mid = piece.points[Math.floor(piece.points.length / 2)]
          const dist = (r: typeof s) => Math.hypot(Math.max(r.left - mid[0], 0, mid[0] - r.right), Math.max(r.bottom - mid[1], 0, mid[1] - r.top))
          const nearest = [...L.slots].sort((a, b) => dist(a) - dist(b))[0]
          expect(dist(s)).toBeLessThanOrEqual(dist(nearest) + 1e-9)
          // and the stroke never enters any slot opening
          for (const [x, y] of piece.points) {
            for (const r of L.slots) {
              const inside = x > r.left + 0.002 && x < r.right - 0.002 && y > r.bottom + 0.002 && y < r.top - 0.002
              expect(inside).toBe(false)
            }
          }
        }
      })
    }
  }
})

describe('reader on the spine', () => {
  for (const grid of grids) {
    it(`${grid.cols}×${grid.rows}: reader sits mid-spine, its ring stays in the lane and clear of every light`, () => {
      const cfg = variant({ grid })
      const L = layout(cfg)
      const sp = buildStrokePath(cfg, L)
      expect(sp.reader.kind).toBe('capsule')
      expect(sp.ring).not.toBeNull()
      const laneWidth = grid.cols > 1 ? cfg.cabinet.mullion : cfg.cabinet.side
      for (const [x] of sp.ring!) expect(Math.abs(x - sp.reader.x) + cfg.stroke.width / 2).toBeLessThanOrEqual(laneWidth / 2 - 0.004)
      for (const piece of sp.pieces) {
        if (piece.slot === null) continue
        for (const [x, y] of piece.points) {
          const nearest = Math.min(...sp.ring!.map(([rx, ry]) => Math.hypot(rx - x, ry - y)))
          expect(nearest).toBeGreaterThan(cfg.stroke.width + 0.004)
        }
      }
    })
  }

  it('default 2×6: reader is within the 15–48 in reach range', () => {
    const sp = buildStrokePath(config, layout(config))
    const inches = sp.reader.y / 0.0254
    expect(inches).toBeGreaterThanOrEqual(15)
    expect(inches).toBeLessThanOrEqual(48)
  })

  it('the stretch under the reader pad is hidden, and the path stays continuous through it', () => {
    const sp = buildStrokePath(config, layout(config))
    expect(sp.pieces.filter((p) => p.hidden).length).toBe(1)
  })
})

describe('buildMachine', () => {
  it('builds the default machine with 12 modules, 12 lights and 12 placards', () => {
    const m = buildMachine(config)
    expect(m.slots.length).toBe(12)
    expect(m.slots.filter((s) => s.module).length).toBe(12)
    expect(m.slots.every((s) => s.light)).toBe(true)
    expect(m.placards.map((p) => p.product)).toEqual(config.modules.map((x) => x.product))
  })

  it('1×8 with the 12-item list: extra modules are ignored', () => {
    const m = buildMachine(variant({ grid: { cols: 1, rows: 8 } }))
    expect(m.slots.length).toBe(8)
    expect(m.placards.length).toBe(8)
  })

  it('3×6 with 12 modules: unfilled slots render empty with their fitment and a dim light', () => {
    const m = buildMachine(variant({ grid: { cols: 3, rows: 6 } }))
    const empty = m.slots.filter((s) => !s.module)
    expect(m.slots.length).toBe(18)
    expect(empty.length).toBe(6)
    for (const s of empty) {
      expect(s.fitment.group.children.length).toBeGreaterThan(0)
      expect(s.light!.emissiveIntensity).toBeLessThan(0.5)
    }
  })

  it('a renamed placard flows through to the placard descriptors', () => {
    const modules = structuredClone(config.modules)
    modules[3] = { product: 'Welding gloves', packed: '12 pairs' }
    const m = buildMachine(variant({ modules }))
    expect(m.placards[3]).toEqual({ slot: 3, product: 'Welding gloves', packed: '12 pairs' })
  })

  it('door style comes from config', () => {
    const side = buildMachine(config)
    const drop = buildMachine(variant({ door: { ...config.door, style: 'drop' } }))
    expect(side.slots[0].module!.door.openAxis).toBe('y')
    expect(drop.slots[0].module!.door.openAxis).toBe('x')
  })
})

const cartons = (m: Machine, slot: number) => m.slots[slot].module!.group.getObjectByName('Contents')!.children.map((c) => c.position)

describe('module contents', () => {
  it('a part-used module has been emptied from the front and the top first', () => {
    const m = buildMachine(config)
    const full = cartons(m, 0)
    const layers = [...new Set(full.map((p) => p.z.toFixed(4)))].map(Number).sort((a, b) => a - b) // back → front
    const rows = [...new Set(full.map((p) => p.y.toFixed(4)))].map(Number).sort((a, b) => a - b) // floor → top
    setContentsFill(m, 0, 0.35)
    const left = cartons(m, 0)
    expect(left.length).toBe(Math.round(full.length * 0.35))
    // The front two layers are bare floor, and what is left on top sits behind what is left below.
    expect(Math.max(...left.map((p) => p.z))).toBeLessThanOrEqual(layers[2] + 1e-6)
    const top = left.filter((p) => p.y > rows[0] + 1e-6).map((p) => p.z)
    const bottom = left.filter((p) => p.y <= rows[0] + 1e-6).map((p) => p.z)
    expect(Math.max(...top)).toBeLessThan(Math.max(...bottom))
  })

  it('fills in one order: every carton in a fuller module is kept in a less used one', () => {
    const m = buildMachine(config)
    const key = (p: { x: number; y: number; z: number }) => [p.x, p.y, p.z].map((v) => v.toFixed(4)).join()
    let prev = new Set<string>()
    for (let f = 1; f <= 10; f++) {
      setContentsFill(m, 0, f / 10)
      const now = new Set(cartons(m, 0).map(key))
      for (const k of prev) expect(now.has(k)).toBe(true)
      prev = now
    }
  })
})

describe('scenes', () => {
  const cols = config.grid.cols
  const midRow = Math.round(config.grid.rows / 2) - 1

  it('swap: Load holds on a packed module, Count on a part-used one', () => {
    const m = buildMachine(config)
    const slot = midRow * cols + cols - 1
    const scene = swapScene(m, slot)
    scene.apply(0.16)
    expect(cartons(m, slot).length).toBe(30)
    scene.apply(0.84)
    expect(cartons(m, slot).length).toBe(11)
  })

  it('exploded: the pulled module is set clear of its opening and of the bezel, then goes home', () => {
    const m = buildMachine(config)
    const slot = cols * Math.max(0, midRow - 1)
    const s = m.slots[slot]
    const g = s.module!.group
    const scene = explodedScene(m, slot)
    for (const p of [0.3, 0.36, 0.6, 0.7]) {
      scene.apply(p)
      expect(g.position.y - s.rect.y).toBeGreaterThan(s.rect.h) // above the opening it came out of
      const tubBack = g.position.z - 0.006 - s.module!.depth
      expect(tubBack).toBeGreaterThan(m.cabinet.bezel.position.z + m.layout.zFront + 0.03) // clear of the bezel, even moved forward
    }
    for (const p of [0, 1]) {
      scene.apply(p)
      expect([g.position.x, g.position.y, g.position.z]).toEqual([s.rect.x, s.rect.y, m.layout.zFront])
    }
  })

  it('exploded: the machine turns nearly face-on while the slot is lit, and back before it separates', () => {
    const m = buildMachine(config)
    const scene = explodedScene(m, cols * Math.max(0, midRow - 1))
    const modularYaw = 0.5 // framings.ts
    scene.apply(0.3) // reduced motion holds here
    expect(modularYaw + m.root.rotation.y).toBeGreaterThan(0)
    expect(modularYaw + m.root.rotation.y).toBeLessThan(0.2) // the connector at the slot's back shows
    for (const p of [0, 0.6, 1]) {
      scene.apply(p)
      expect(m.root.rotation.y).toBeCloseTo(0, 9)
    }
  })

  it('unlock: the badge shows only around the tap, on the pad; the machine never carries one', () => {
    expect(buildMachine(config).root.getObjectByName('Badge')).toBeUndefined()
    const m = buildMachine(config)
    const scene = unlockScene(m, (midRow + 1) * cols)
    const badge = m.root.getObjectByName('Badge')!
    for (const p of [0, 0.02, 0.4, 0.62, 1]) {
      scene.apply(p)
      expect(badge.visible).toBe(false)
    }
    scene.apply(0.2)
    expect(badge.visible).toBe(true)
    const padFace = m.reader.group.position.z + 0.006
    expect(badge.position.z - padFace).toBeGreaterThanOrEqual(0)
    expect(badge.position.z - padFace).toBeLessThan(0.002)
  })

  it('unlock: the ring pulses in its section and is left to the free views outside it', () => {
    const m = buildMachine(config)
    const ring = m.materials.readerRing
    const scene = unlockScene(m, (midRow + 1) * cols)
    scene.apply(0.22)
    expect(ring.emissiveIntensity).toBeGreaterThan(pipeIntensity.reader + 1)
    scene.apply(1)
    expect(ring.emissiveIntensity).toBe(pipeIntensity.reader)
    // A free-view unlock pulse (interaction.ts tweens the same material) survives the next frames.
    ring.emissiveIntensity = pipeIntensity.reader + 1.4
    scene.apply(1)
    scene.apply(0)
    expect(ring.emissiveIntensity).toBe(pipeIntensity.reader + 1.4)
  })
})
