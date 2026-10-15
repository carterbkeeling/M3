// Shared scroll geometry: where each section sits, which tone is behind the nav, how far through a
// tall (sticky) section the reader is, and a smooth blend across each section boundary.
// Recomputed on resize; read every frame by the page chrome and the 3D stage.

export interface SectionInfo {
  el: HTMLElement
  id: string // framing key
  navId: string // the nav section it belongs to
  tone: 'dark' | 'light'
  top: number
  height: number
}

let sections: SectionInfo[] = []

// Sections, plus any [data-frame] block inside one (e.g. the module gallery) that needs its own
// machine framing. Ordered by position on the page.
export function measure() {
  const els = Array.from(document.querySelectorAll<HTMLElement>('main > section, body > footer, [data-frame]'))
  sections = els
    .map((el) => {
      const r = el.getBoundingClientRect()
      return {
        el,
        id: el.id,
        navId: el.dataset.frame !== undefined ? (el.closest('section')?.id ?? el.id) : el.id,
        tone: (el.dataset.tone as 'dark' | 'light') ?? 'dark',
        top: r.top + window.scrollY,
        height: r.height,
      }
    })
    .sort((a, b) => a.top - b.top)
  return sections
}

export const getSections = () => sections

export const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

// Index of the section at viewport position y (in page coordinates).
export function sectionAt(y: number): number {
  let i = 0
  for (let k = 0; k < sections.length; k++) if (sections[k].top <= y) i = k
  return i
}

// Blend between consecutive sections around the viewport center: returns [from, to, t].
// The crossfade spans `zone` × viewport height, centered where a section's top crosses mid-screen.
export function boundaryBlend(scrollY: number, vh: number, zone = 0.4): [number, number, number] {
  const mid = scrollY + vh / 2
  for (let k = 1; k < sections.length; k++) {
    const t = (mid - (sections[k].top - (zone * vh) / 2)) / (zone * vh)
    if (t >= 0 && t <= 1) return [k - 1, k, smoothstep(t)]
  }
  const i = sectionAt(mid)
  return [i, i, 0]
}

// Progress (0–1) through a tall section's sticky span.
export function stickyProgress(el: HTMLElement, scrollY: number, vh: number): number {
  const s = sections.find((x) => x.el === el || x.el.contains(el))
  const top = s && s.el === el ? s.top : el.getBoundingClientRect().top + scrollY
  const h = el.offsetHeight
  return Math.min(1, Math.max(0, (scrollY - top) / Math.max(1, h - vh)))
}
