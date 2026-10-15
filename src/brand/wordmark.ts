/**
 * m³ wordmark candidates (Phase 1, revised after the independent critique).
 *
 * Every mark is ONE constant stroke weight. The path data is the stroke CENTERLINE: draw it with
 * `stroke-width = strokeWidth`, round caps, round joins and no fill. Paths use only absolute
 * M / H / V / A commands on a 2.5-unit grid, so every turn is a true circular arc of an exact
 * radius and every straight is exactly horizontal or vertical (no Béziers, no taper).
 *
 * Grid conventions (viewBox units, y down), shared by all candidates:
 *   - stroke width w = 10, m height H = 80 (w = H / 8)
 *   - at 16 px tall (the nav size) one unit is exactly 0.2 px, so the stroke is exactly the UI's
 *     2 px stroke and the m's stems and the ³'s bars land on whole pixels (crisp at 1x); the same
 *     holds at 32, 48, 64, 80 and 96 px
 *   - viewBox widths are multiples of 5, so at 16 px the mark is a whole number of pixels wide and
 *     whatever follows it in the nav stays on the pixel grid; the ³'s bowl edges sit on multiples
 *     of 5 for the same reason
 *   - the viewBox is the tight outer bound of the stroked mark (round caps included)
 *   - y = 0 is the top of the m; the bottom edge of the viewBox is the baseline
 *   - the superscript 3 hangs from the top line: y 0–50, i.e. 62.5 % of the m's height
 *   - a path that reverses on itself (e.g. `V75 V22.5` on Twin arch's middle stem) is a deliberate
 *     retrace: it draws as one stroke, and in the loader the pen runs back over ink that is already
 *     there. The loader runs retraces fast (see LOADER_TIMING) so they don't read as a stall.
 *
 * `paths` is the resting mark. Some paths overlap (Slot's mullion starts inside its roof), so stack
 * them in one <g> and apply any transparency to the group (`opacity`), never per path
 * (`stroke-opacity`), or the overlaps show.
 *
 * `loader` is the draw-on choreography (DrawSVG). Its final state must equal `paths`; the dev-only
 * specimen (wordmarks.html) checks that by rasterising both.
 */

/** One stroke of the loader choreography. */
export interface LoaderStep {
  /** Short name shown on the specimen's loader timeline. */
  label: string
  /** Stroke centerline (same rules as `paths`). */
  d: string
  /**
   * 'draw' (default): the stroke grows from its start (DrawSVG '0%' → '100%').
   * 'retract': an earlier temporary stroke with the same `d` shrinks from its start and is gone at
   * rest (DrawSVG '0% 100%' → '100% 100%').
   */
  mode?: 'draw' | 'retract'
  /** Start at the same moment as the previous step instead of after it. */
  withPrevious?: boolean
}

export interface WordmarkCandidate {
  /** Stable id, used in filenames (`wordmark-<id>.png`). */
  id: string
  /** Display name. */
  name: string
  /** One-line description of the construction. */
  description: string
  /** Tight outer bounds of the stroked mark. */
  viewBox: string
  /** Stroke width in viewBox units. */
  strokeWidth: number
  /** The resting mark: stroke centerlines (their union is the mark). */
  paths: string[]
  /**
   * True when the loader never lifts the pen: every stroke after the first starts inside ink that is
   * already on screen, so the mark draws as one unbroken stroke. False: the pen lifts once between
   * the m and the ³.
   */
  singleStroke: boolean
  /** Loader choreography, in order. */
  loader: LoaderStep[]
}

/**
 * Loader timing model, in pen-travel units (one unit = one viewBox unit of stroke drawn at normal
 * speed). The specimen (src/wordmarks.ts) implements it; the Phase 3 loader scales the total to ≤ 1.2 s.
 */
export const LOADER_TIMING = {
  /** A retrace (the pen running back over its own ink) takes 40 % of its share by length (2.5× speed). */
  retraceWeight: 0.4,
  /** A 'retract' step runs at the same fast rate. */
  retractWeight: 0.4,
  /**
   * After a pen lift the next stroke starts this much pen travel before the previous one ends, so the
   * lift reads as one gesture (≈ 60–80 ms in a 1.2 s loader).
   */
  liftLead: 20,
} as const

// ---------------------------------------------------------------------------------------------
// Shared strokes
// ---------------------------------------------------------------------------------------------

/**
 * Twin arch m: up the left stem, a semicircular R17.5 arch, down the middle stem, back up it, a
 * second identical arch, down the right stem. Stems at x = 5 / 40 / 75 (counters 25 = 2.5w), 80 × 80.
 */
const TWIN_M = 'M5 75 V22.5 A17.5 17.5 0 0 1 40 22.5 V75 V22.5 A17.5 17.5 0 0 1 75 22.5 V75'

/**
 * Twin arch ³, top-down: top bar, upper R10 bowl, tongue (out to x 100 and back), lower R10 bowl,
 * bottom bar. x 90–125: the upper bowl is 30 wide and the lower 35, so their right edges land on
 * 24 px and 25 px at 16 px; the tongue tip is inset 5 units (1 px at 16 px) from the terminals.
 * Gap to the m's right stem = 10 (= w).
 */
const TWIN_SUP = 'M95 5 H105 A10 10 0 0 1 105 25 H100 H110 A10 10 0 0 1 110 45 H95'

/** Worm link: from inside the m's right stem, a tight R10 U-turn on the baseline, up, and an R10 turn into the ³'s bottom bar. */
const WORM_LINK = 'M75 65 A10 10 0 0 0 95 65 V55 A10 10 0 0 1 105 45'

/** Twin arch ³ drawn bottom-up from the link's end, without the bottom terminal (x 95–105). */
const TWIN_SUP_UP = 'M105 45 H110 A10 10 0 0 0 110 25 H100 H105 A10 10 0 0 0 105 5 H95'

/** The ³'s bottom terminal, drawn last so the retracting link appears to settle into it. */
const TWIN_SUP_TAIL = 'M105 45 H95'

/** Slot frame: left stem up, R10 turn, one flat roof across both counters, R10 turn, right stem down (no retrace). */
const SLOT_FRAME = 'M5 75 V15 A10 10 0 0 1 15 5 H75 A10 10 0 0 1 85 15 V75'
/** Slot mullion: the left counter's R10 fillet peels off the roof and runs down as the middle stem. */
const SLOT_MULLION = 'M35 5 A10 10 0 0 1 45 15 V75'
/** The right counter's R10 fillet, drawn together with the mullion so both fillets meet at (45, 15). */
const SLOT_FILLET = 'M55 5 A10 10 0 0 0 45 15'
/**
 * Slot ³: Twin arch's ³ moved 15 to the right. x 105–140, gap to the m's right stem = 15 (1.5w) and
 * 16.4 from the roof's outer corner to the top terminal; bowl edges at 27 / 28 px at 16 px.
 */
const SLOT_SUP = 'M110 5 H120 A10 10 0 0 1 120 25 H115 H125 A10 10 0 0 1 125 45 H110'

// ---------------------------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------------------------

/**
 * 1 · Twin arch
 * Two equal R17.5 arches as one stroke, then a separate superscript ³ of two R10 bowls.
 * The loader runs the middle-stem retrace at 2.5× and starts the ³ just before the m ends.
 */
const twinArch: WordmarkCandidate = {
  id: 'twin-arch',
  name: 'Twin arch',
  description:
    'Two equal R17.5 arches drawn as one stroke (the middle stem is retraced, fast in the loader), then a separate superscript ³ of two R10 bowls whose right edges land on whole pixels at 16 px.',
  viewBox: '0 0 125 80',
  strokeWidth: 10,
  paths: [TWIN_M, TWIN_SUP],
  singleStroke: false,
  loader: [
    { label: 'm', d: TWIN_M },
    { label: '³', d: TWIN_SUP },
  ],
}

/**
 * 2 · Worm flow
 * The static version (the m's right stem hooking up into the ³) read as "mu3" / "mʒ", tied the ³ to
 * the baseline and was the closest to the Muni worm, so it is retired as a resting mark. What is
 * kept is the idea, as a loader: at rest this candidate is exactly Twin arch, but the pen never
 * lifts. The m's right foot runs on through a temporary link into the ³, which draws bottom-up;
 * the link then retracts from its start (the worm pulls its tail in) while the ³'s bottom terminal
 * draws, leaving the fixed Twin arch.
 */
const wormFlow: WordmarkCandidate = {
  id: 'worm-flow',
  name: 'Worm flow',
  description:
    'At rest it is exactly Twin arch (the static hooked version read as “mu3” and lost the superscript, so it is retired). Its loader never lifts the pen: the m’s right foot runs on through a temporary R10 link into the ³, which draws bottom-up; the link then retracts into the ³’s bottom terminal.',
  viewBox: '0 0 125 80',
  strokeWidth: 10,
  paths: [TWIN_M, TWIN_SUP],
  singleStroke: true,
  loader: [
    { label: 'm', d: TWIN_M },
    { label: 'link', d: WORM_LINK },
    { label: '³ bottom-up', d: TWIN_SUP_UP },
    { label: 'link retracts', d: WORM_LINK, mode: 'retract' },
    { label: '³ terminal', d: TWIN_SUP_TAIL, withPrevious: true },
  ],
}

/**
 * 3 · Slot
 * A squarer, wider m whose counters read as two rounded slots side by side (the m³ cabinet is two
 * columns of slots). Every turn in the mark is the same R10 quarter turn (inner radius w/2). The m
 * is a frame (stems and one flat roof) plus a mullion whose two R10 fillets meet under the roof, so
 * the roof stays flat (no nick) and nothing is retraced.
 *
 *   m   stems at x = 5 / 45 / 85 (counters 30 = 3w), flat roof, 90 × 80 (wider than tall)
 *   ³   x 105–140, y 0–50, R10 bowls; it stays 50 units tall, so its bowls are round, not squared
 */
const slot: WordmarkCandidate = {
  id: 'slot',
  name: 'Slot',
  description:
    'A squarer, wider m: one flat roof over two counters like machine slots, with the middle stem dropped in as a mullion; every turn is the same R10 (inner radius w/2). The ³ keeps the 50-unit superscript height (so its bowls stay round) and sits 1.5w from the m.',
  viewBox: '0 0 140 80',
  strokeWidth: 10,
  paths: [SLOT_FRAME, SLOT_MULLION, SLOT_FILLET, SLOT_SUP],
  singleStroke: false,
  loader: [
    { label: 'frame', d: SLOT_FRAME },
    { label: 'mullion', d: SLOT_MULLION },
    { label: 'fillet', d: SLOT_FILLET, withPrevious: true },
    { label: '³', d: SLOT_SUP },
  ],
}

/** All Phase 1 candidates, in presentation order. */
export const wordmarks: readonly WordmarkCandidate[] = [twinArch, wormFlow, slot]

/** Accessible name for the mark wherever it stands in for the brand name. */
export const WORDMARK_LABEL = 'm³ (M-cubed)'

/** viewBox as numbers: [minX, minY, width, height]. */
export function viewBoxOf(c: Pick<WordmarkCandidate, 'viewBox'>): [number, number, number, number] {
  const [x = 0, y = 0, w = 0, h = 0] = c.viewBox.trim().split(/[\s,]+/).map(Number)
  return [x, y, w, h]
}

/**
 * Standalone SVG markup for a candidate's resting mark at a given pixel height (width follows the
 * viewBox). DOM-free, so it also works for build scripts (favicon / OG image).
 */
export function wordmarkSvg(
  c: Pick<WordmarkCandidate, 'viewBox' | 'strokeWidth' | 'paths'>,
  opts: { color?: string; height?: number; label?: string } = {},
): string {
  const { color = 'currentColor', height = 32, label = WORDMARK_LABEL } = opts
  const [, , vw, vh] = viewBoxOf(c)
  const width = +((height * vw) / vh).toFixed(3)
  const paths = c.paths.map((d) => `<path d="${d}"/>`).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.viewBox}" width="${width}" height="${height}" role="img" aria-label="${label}">` +
    `<g fill="none" stroke="${color}" stroke-width="${c.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>` +
    `</svg>`
  )
}
