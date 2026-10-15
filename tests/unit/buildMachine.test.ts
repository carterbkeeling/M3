import { describe, expect, it } from 'vitest'
import { config, type MachineConfig, type StrokePathKind } from '../../src/model/config.ts'
import { buildMachine } from '../../src/model/buildMachine.ts'
import { layout, outerDims } from '../../src/model/dims.ts'
import { buildStrokePath } from '../../src/model/strokePath.ts'

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
