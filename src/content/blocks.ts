import { config } from '../model/config.ts'
import { wordmark, wordmarkSvg } from '../brand/wordmark.ts'
import { galleryHtml, specTableHtml } from './specs.ts'
import { elevationSvg } from '../ui/elevation.ts'

// Static HTML blocks generated from config.ts and the content modules. index.html marks where
// each goes with <!--@name-->; vite.config.ts expands them for dev and build, and
// scripts/copy-review.ts expands them the same way so COPY-REVIEW sees the real page text.

// One continuous stroke with a constant-radius dip: the section divider (draws itself on scroll).
// The stroke runs along y = 20 (the section boundary; layout.css places it) and dips to y = 44, so
// the viewBox (y 12–52) leaves room on both sides for the whole stroke.
const DIVIDER =
  '<svg class="divider" viewBox="0 12 1440 40" preserveAspectRatio="none" aria-hidden="true">' +
  '<path d="M0 20 H600 A12 12 0 0 1 612 32 A12 12 0 0 0 624 44 H816 A12 12 0 0 0 828 32 A12 12 0 0 1 840 20 H1440" /></svg>'

export const htmlBlocks: Record<string, () => string> = {
  'spec-table': () => specTableHtml(config),
  gallery: () => galleryHtml(config),
  elevation: () => elevationSvg(config),
  'wordmark-nav': () => wordmarkSvg(wordmark, { height: 22 }),
  'wordmark-hero': () => wordmarkSvg(wordmark, { height: 240 }),
  'wordmark-footer': () => wordmarkSvg(wordmark, { height: 48 }),
  'slot-count': () => String(config.grid.cols * config.grid.rows),
  divider: () => DIVIDER,
}

export function expandBlocks(html: string): string {
  return html.replace(/<!--@([a-z-]+)-->/g, (m, key: string) => (htmlBlocks[key] ? htmlBlocks[key]() : m))
}
