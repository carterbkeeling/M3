import { config as defaultConfig, type MachineConfig } from '../model/config.ts'
import { layout } from '../model/dims.ts'

// Orthographic front elevation with dimension lines, generated from config.ts (DOM-free).
// Used beside the spec table, for print, and as the no-WebGL spec view. Units: millimeters.

// Margin around the machine in the drawing (mm). The stage reads it to register the live
// orthographic machine to the drawing's outline.
export const ELEVATION_PAD = 170

export function elevationSvg(cfg: MachineConfig = defaultConfig): string {
  const L = layout(cfg)
  const mm = (m: number) => Math.round(m * 1000)
  const W = mm(L.W)
  const H = mm(L.H)
  const pad = ELEVATION_PAD
  const vbW = W + pad * 2
  const vbH = H + pad * 2
  // y in SVG grows downward; machine floor at y = pad + H
  const X = (x: number) => pad + mm(x) + W / 2
  const Y = (y: number) => pad + H - mm(y)
  const slots = L.slots
    .map((s) => `<rect x="${X(s.left)}" y="${Y(s.top)}" width="${mm(s.w)}" height="${mm(s.h)}" rx="${mm(cfg.radius.inner)}"/>`)
    .join('')
  const inch = (m: number) => Math.round(m / 0.0254)
  const dimH = `≈ ${inch(L.H)} in · ${(L.H).toFixed(2)} m`
  const dimW = `≈ ${inch(L.W)} in · ${(L.W).toFixed(2)} m`
  const right = pad + W + 70
  const bottom = pad + H + 80
  return (
    `<svg class="elevation" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="Front elevation of m³: approximately ${inch(L.H)} inches high and ${inch(L.W)} inches wide, ${L.slots.length} slots in ${cfg.grid.cols} columns of ${cfg.grid.rows}.">` +
    `<g class="elevation__body" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round">` +
    `<rect x="${pad}" y="${Y(L.H)}" width="${W}" height="${mm(L.H - L.skinBottom)}" rx="${mm(cfg.radius.corner)}"/>` +
    `<rect x="${pad + 30}" y="${Y(L.skinBottom)}" width="${W - 60}" height="${mm(L.skinBottom - L.feet)}" rx="8"/>` +
    `<g stroke-width="3">${slots}</g>` +
    `</g>` +
    `<g class="elevation__dims" fill="none" stroke="currentColor" stroke-width="2">` +
    `<path d="M${right - 20} ${pad} H${right + 20} M${right - 20} ${pad + H} H${right + 20} M${right} ${pad} V${pad + H}"/>` +
    `<path d="M${pad} ${bottom - 20} V${bottom + 20} M${pad + W} ${bottom - 20} V${bottom + 20} M${pad} ${bottom} H${pad + W}"/>` +
    `</g>` +
    `<g class="elevation__labels" fill="currentColor" font-size="56">` +
    `<text x="${right + 18}" y="${pad + H / 2}" transform="rotate(90 ${right + 18} ${pad + H / 2})" text-anchor="middle" dy="-0.4em">${dimH}</text>` +
    `<text x="${pad + W / 2}" y="${bottom + 50}" text-anchor="middle">${dimW}</text>` +
    `</g></svg>`
  )
}
