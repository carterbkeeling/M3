// Writes public/favicon.svg from the approved wordmark: Pipe Cyan mark on a graphite rounded square.
// Run: node scripts/gen-favicon.ts
import { writeFileSync } from 'node:fs'
import { viewBoxOf, wordmark } from '../src/brand/wordmark.ts'

const [, , vw, vh] = viewBoxOf(wordmark)
const size = 64
const pad = 10
const scale = (size - pad * 2) / Math.max(vw, vh)
const tx = (size - vw * scale) / 2
const ty = (size - vh * scale) / 2
const paths = wordmark.paths.map((d) => `<path d="${d}"/>`).join('')
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
  `<rect width="${size}" height="${size}" rx="14" fill="#15161A"/>` +
  `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})" fill="none" stroke="#12D6FF" stroke-width="${wordmark.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>` +
  `</svg>\n`
writeFileSync('public/favicon.svg', svg)
console.log(`public/favicon.svg (${svg.length} bytes)`)
