import * as THREE from 'three'
import type { Machine } from './buildMachine.ts'

// Placard text (browser-only). buildMachine() leaves every placard insert blank so it stays
// DOM-free; this draws ONE high-resolution canvas atlas with every placard on it (product name in
// M PLUS Rounded 1c 900, "Packed: N" in JetBrains Mono, graphite on bone), points each insert's
// UVs at its own cell and puts the atlas on the single shared insert material.
// No module ID (decision C) and no brand marks. Works with the self-hosted woff2 fonts, and the
// result exports into the GLB and the rendered stills like any other texture.

export interface PlacardAtlas {
  texture: THREE.CanvasTexture
  canvas: HTMLCanvasElement
  /** Atlas cell (canvas pixels, origin top left) per slot index; empty slots have none. */
  cells: Map<number, { x: number; y: number; w: number; h: number }>
  /** Resolves once the atlas has been drawn with the real fonts (immediately if they loaded in time). */
  fontsReady: Promise<boolean>
  dispose(): void
}

export interface PlacardOptions {
  /** Draw with fallback fonts if the webfonts take longer than this, then redraw when they land. */
  fontTimeoutMs?: number
  /** Called once the atlas is on the inserts, and again after a late-font redraw (a host that renders
   *  on demand draws a frame, so the new texture shows). */
  onDraw?: () => void
}

const NAME_FONT = '"M PLUS Rounded 1c"'
const MONO_FONT = '"JetBrains Mono Variable"'
const NAME_STACK = `${NAME_FONT}, "Arial Rounded MT Bold", system-ui, sans-serif`
const MONO_STACK = `${MONO_FONT}, ui-monospace, Consolas, monospace`

// Insert artwork (graphite on bone), in millimeters on the printed insert.
const INK = '#15161A'
const INK_SOFT = '#3C3E44' // the quantity line: a step lighter than the name, still ≥ 9:1 on bone
const BONE = '#F3EFE7'
const LAYOUT = {
  padX: 6.5, // from the visible window's edge
  padTop: 6.2,
  padBottom: 6,
  nameMax: 16.5, // name font size, one line
  nameLine: 1.02, // line height (× font size) when the name takes two lines
  packed: 7.6, // "Packed: N" font size
  gap: 3.5, // minimum space between the name block and the quantity line
}

const CELL_PITCH = 1024 // px per cell along the insert's width (incl. gutters), before downscaling
const GUTTER = 8 // bone-filled px around each cell, so mipmaps never bleed one placard into another
const MAX_ATLAS = 4096

let fontsLoaded: Promise<boolean> | null = null

// Load both faces once (the page and the lab import the @fontsource CSS that declares them).
function loadFonts(sample: string): Promise<boolean> {
  fontsLoaded ??= (async () => {
    if (!('fonts' in document)) return false
    try {
      const [name, mono] = await Promise.all([
        document.fonts.load(`900 64px ${NAME_FONT}`, sample),
        document.fonts.load(`500 64px ${MONO_FONT}`, 'Packed: 0123456789'),
      ])
      return name.length > 0 && mono.length > 0
    } catch {
      return false
    }
  })()
  return fontsLoaded
}

export async function applyPlacards(machine: Machine, renderer: THREE.WebGLRenderer, opts: PlacardOptions = {}): Promise<PlacardAtlas> {
  // Every filled slot with a placard; empty slots simply have no entry.
  const entries = machine.placards.flatMap((p) => {
    const insert = machine.slots.find((s) => s.rect.index === p.slot)?.module?.door.placard.insert
    return insert ? [{ ...p, insert, size: insertSize(insert) }] : []
  })

  // Wait for the fonts (bounded), so the first draw is already the real thing.
  const sample = entries.map((e) => e.product).join(' ') || 'Placard'
  const fonts = loadFonts(sample)
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), opts.fontTimeoutMs ?? 4000))
  const first = await Promise.race([fonts, timeout])

  // Cell size: CELL_PITCH across the insert's width, height from the widest insert's aspect.
  const aspect = Math.max(...entries.map((e) => e.size.h / e.size.w), 0.3)
  const maxTex = Math.min(MAX_ATLAS, renderer.capabilities.maxTextureSize || MAX_ATLAS)
  const n = Math.max(1, entries.length)
  let pitchW = CELL_PITCH
  let pack = packGrid(n, pitchW, aspect)
  while ((pack.width > maxTex || pack.height > maxTex) && pitchW > 128) {
    pitchW = Math.floor(pitchW * 0.85)
    pack = packGrid(n, pitchW, aspect)
  }

  const canvas = document.createElement('canvas')
  canvas.width = pack.width
  canvas.height = pack.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('placardAtlas: 2D canvas unavailable')

  const cells = new Map<number, { x: number; y: number; w: number; h: number }>()
  entries.forEach((e, i) => {
    const col = i % pack.cols
    const row = Math.floor(i / pack.cols)
    const x = col * pack.pitchW + GUTTER
    const y = row * pack.pitchH + GUTTER
    cells.set(e.slot, { x, y, w: pack.pitchW - 2 * GUTTER, h: Math.round((pack.pitchW - 2 * GUTTER) * (e.size.h / e.size.w)) })
  })

  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = BONE
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (const e of entries) drawPlacard(ctx, cells.get(e.slot)!, e.size, e.product, e.packed)
  }
  draw()

  const texture = new THREE.CanvasTexture(canvas)
  texture.name = 'PlacardAtlas'
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  texture.userData.placardAtlas = true

  // Point each insert at its cell (absolute, from the plane's own extent, so re-applying is safe).
  for (const e of entries) {
    const c = cells.get(e.slot)!
    setPlaneUVs(e.insert.geometry, {
      u0: c.x / canvas.width,
      u1: (c.x + c.w) / canvas.width,
      v0: 1 - (c.y + c.h) / canvas.height, // CanvasTexture flips Y: canvas top = v 1
      v1: 1 - c.y / canvas.height,
    })
  }

  // One shared insert material carries the atlas (white color so the art's bone shows as drawn).
  const material = machine.materials.placardInsert
  const previous = material.map
  material.map = texture
  material.color.set('#FFFFFF')
  material.needsUpdate = true
  for (const e of entries) e.insert.material = material
  if (previous && previous !== texture && previous.userData.placardAtlas) previous.dispose()
  opts.onDraw?.()

  // If the fonts were late, redraw once they land.
  const fontsReady =
    first === true
      ? Promise.resolve(true)
      : fonts.then((ok) => {
          if (ok && material.map === texture) {
            draw()
            texture.needsUpdate = true
            opts.onDraw?.()
          } else if (!ok && import.meta.env.DEV) {
            console.warn('placardAtlas: webfonts unavailable; placards use fallback fonts')
          }
          return ok
        })

  return {
    texture,
    canvas,
    cells,
    fontsReady,
    dispose() {
      if (material.map === texture) {
        material.map = null
        material.needsUpdate = true
      }
      texture.dispose()
    },
  }
}

// ---- Layout -----------------------------------------------------------------------------------

interface InsertSize {
  w: number // insert (m)
  h: number
  windowW: number // visible window (m); the insert's edges run under the holder's rim
  windowH: number
}

function insertSize(insert: THREE.Mesh): InsertSize {
  const ud = insert.userData.placard as InsertSize | undefined
  if (ud) return ud
  const g = insert.geometry
  g.computeBoundingBox()
  const b = g.boundingBox!
  const w = b.max.x - b.min.x
  const h = b.max.y - b.min.y
  return { w, h, windowW: w, windowH: h }
}

function packGrid(n: number, pitchW: number, aspect: number) {
  const cellW = pitchW - 2 * GUTTER
  const pitchH = Math.ceil(cellW * aspect) + 2 * GUTTER
  // Pick the column count that keeps the atlas closest to square.
  let best = { cols: 1, width: pitchW, height: n * pitchH }
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const width = cols * pitchW
    const height = rows * pitchH
    if (Math.max(width, height) < Math.max(best.width, best.height)) best = { cols, width, height }
  }
  return { cols: best.cols, pitchW, pitchH, width: roundUp4(best.width), height: roundUp4(best.height) }
}

const roundUp4 = (v: number) => Math.ceil(v / 4) * 4

function drawPlacard(
  ctx: CanvasRenderingContext2D,
  cell: { x: number; y: number; w: number; h: number },
  size: InsertSize,
  product: string,
  packed: string,
) {
  const pxPerMm = cell.w / (size.w * 1000)
  const mm = (v: number) => v * pxPerMm
  // The visible window inside the cell.
  const wx = cell.x + mm(((size.w - size.windowW) / 2) * 1000)
  const wy = cell.y + mm(((size.h - size.windowH) / 2) * 1000)
  const ww = mm(size.windowW * 1000)
  const wh = mm(size.windowH * 1000)

  ctx.save()
  ctx.beginPath()
  ctx.rect(cell.x, cell.y, cell.w, cell.h)
  ctx.clip()
  ctx.fillStyle = BONE
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  const left = wx + mm(LAYOUT.padX)
  const availW = ww - 2 * mm(LAYOUT.padX)

  // Quantity line, bottom left.
  const packedText = `Packed: ${packed}`
  let packedPx = mm(LAYOUT.packed)
  ctx.font = `500 ${packedPx}px ${MONO_STACK}`
  const pw = ctx.measureText(packedText).width
  if (pw > availW) {
    packedPx *= availW / pw
    ctx.font = `500 ${packedPx}px ${MONO_STACK}`
  }
  const packedBase = wy + wh - mm(LAYOUT.padBottom)
  ctx.fillStyle = INK_SOFT
  ctx.fillText(packedText, left, packedBase)
  const packedTop = packedBase - ctx.measureText('Packed').actualBoundingBoxAscent

  // Name, top left: one line as large as allowed, else two balanced lines, shrinking to fit.
  const top = wy + mm(LAYOUT.padTop)
  const availH = packedTop - mm(LAYOUT.gap) - top
  const layout = fitName(ctx, product, availW, availH, mm(LAYOUT.nameMax))
  ctx.font = `900 ${layout.px}px ${NAME_STACK}`
  ctx.fillStyle = INK
  const capH = ctx.measureText('H').actualBoundingBoxAscent
  layout.lines.forEach((line, i) => {
    ctx.fillText(line, left, top + capH + i * layout.px * LAYOUT.nameLine, availW + 1)
  })
  ctx.restore()
}

interface NameLayout {
  lines: string[]
  px: number
}

// The largest size (≤ max) at which the name fits availW × availH on one line or two.
export function fitName(ctx: CanvasRenderingContext2D, text: string, availW: number, availH: number, max: number): NameLayout {
  const REF = 100
  ctx.font = `900 ${REF}px ${NAME_STACK}`
  const width = (s: string) => ctx.measureText(s).width / REF // width per 1 px of font size
  const capAt = ctx.measureText('H').actualBoundingBoxAscent / REF
  const descAt = Math.max(0.12, ctx.measureText('gjpqy').actualBoundingBoxDescent / REF)

  // One line: limited by width and by the space for one line of text.
  const oneHeight = capAt + descAt
  const one = Math.min(max, availW / width(text), availH / oneHeight)

  // Two lines: try every break between words (and after hyphens), keep the most balanced one.
  let two: NameLayout | null = null
  const breaks: Array<[string, string]> = []
  for (let i = 1; i < text.length; i++) {
    if (text[i] === ' ') breaks.push([text.slice(0, i), text.slice(i + 1)])
    else if (text[i - 1] === '-' && text[i] !== ' ') breaks.push([text.slice(0, i), text.slice(i)])
  }
  for (const [a, b] of breaks) {
    const lineW = Math.max(width(a), width(b))
    const twoHeight = capAt + LAYOUT.nameLine + descAt
    const px = Math.min(max, availW / lineW, availH / twoHeight)
    if (!two || px > two.px) two = { lines: [a, b], px }
  }

  // Prefer one line unless two lines let the name be clearly larger. Either way it fits.
  if (!two || one >= max * 0.98 || one >= two.px * 0.9) return { lines: [text], px: one }
  return two
}

function setPlaneUVs(geometry: THREE.BufferGeometry, r: { u0: number; u1: number; v0: number; v1: number }) {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  let uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2)
    geometry.setAttribute('uv', uv)
  }
  geometry.computeBoundingBox()
  const b = geometry.boundingBox!
  const sx = b.max.x - b.min.x || 1
  const sy = b.max.y - b.min.y || 1
  for (let i = 0; i < pos.count; i++) {
    const s = (pos.getX(i) - b.min.x) / sx
    const t = (pos.getY(i) - b.min.y) / sy
    uv.setXY(i, r.u0 + s * (r.u1 - r.u0), r.v0 + t * (r.v1 - r.v0))
  }
  uv.needsUpdate = true
}
