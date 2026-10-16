import { config as defaultConfig, type MachineConfig } from '../model/config.ts'
import { outerDims } from '../model/dims.ts'

// Spec rows for the spec sheet. Dimension and slot rows are computed from config.ts (the same
// source as the model and the elevation drawing); unknown values are null and render as TBD chips.
// DOM-free: rendered to static HTML at build time and reused by the page.

export interface SpecRow {
  id: string
  label: string
  value: string | null // null → TBD chip
  note?: string // small mono qualifier, e.g. "approx."
  tbdHint?: string // what is known while the value itself is TBD
  draft?: boolean // wording beyond Product truth: marked <!-- DRAFT --> and listed in COPY-REVIEW
  approved?: string // date the draft wording was approved (marker becomes <!-- APPROVED date -->)
}

const inches = (m: number) => Math.round(m / 0.0254)
const meters = (m: number) => m.toFixed(2)

export function specRows(cfg: MachineConfig = defaultConfig): SpecRow[] {
  const { W, H, D } = outerDims(cfg)
  const slots = cfg.grid.cols * cfg.grid.rows
  return [
    {
      id: 'dimensions',
      label: 'Dimensions (H × W × D)',
      value: `≈ ${inches(H)} × ${inches(W)} × ${inches(D)} in · ${meters(H)} × ${meters(W)} × ${meters(D)} m`,
      note: 'approx.',
    },
    { id: 'slots', label: 'Slots', value: `${slots} (${cfg.grid.cols} × ${cfg.grid.rows}), one universal fitment each` },
    { id: 'modules', label: 'Modules', value: 'One universal size · one product per module' },
    { id: 'access', label: 'Access', value: 'Badge or phone tap at the reader · openings logged', draft: true, approved: '2026-10-15' },
    { id: 'connected', label: 'Connected functions', value: 'Access control · plugged-in status · service and restock alerts' },
    { id: 'connectivity', label: 'Connectivity type', value: null },
    { id: 'power', label: 'Power input', value: null, tbdHint: 'Low-voltage' },
    { id: 'resin', label: 'Resin', value: null, tbdHint: 'Injection-molded plastic' },
    { id: 'weight', label: 'Weight', value: null },
    { id: 'capacity', label: 'Module capacity', value: null },
    { id: 'warranty', label: 'Warranty', value: null },
    { id: 'price', label: 'Price', value: '$15,000 retail' },
  ]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const tbdChip = (hint?: string) =>
  `${hint ? `<span class="spec__hint">${esc(hint)}</span> ` : ''}<span class="tbd"><span aria-hidden="true">TBD</span><span class="sr-only">to be determined</span></span>`

export function specTableHtml(cfg: MachineConfig = defaultConfig): string {
  const rows = specRows(cfg)
    .map(
      (r) =>
        `<tr data-spec="${r.id}" data-copy="spec.${r.id}"><th scope="row">${esc(r.label)}</th><td>${r.value === null ? tbdChip(r.tbdHint) : esc(r.value)}${r.note ? ` <span class="spec__note">${esc(r.note)}</span>` : ''}</td></tr>${r.draft ? (r.approved ? `<!-- APPROVED ${r.approved} -->` : '<!-- DRAFT -->') : ''}`,
    )
    .join('')
  return `<table class="spec"><caption class="sr-only">m³ specifications</caption><tbody>${rows}</tbody></table>`
}

// Gallery card wording (draft; listed in COPY-REVIEW).
export const GALLERY_LABELS = { full: 'Full', returned: 'Returned to the warehouse', srHint: ', show returned' }

// Module gallery cards, one per configured module. The product and packed quantity come from
// config.modules, so placard edits flow through with no other changes.
export function galleryHtml(cfg: MachineConfig = defaultConfig): string {
  const n = cfg.grid.cols * cfg.grid.rows
  return cfg.modules
    .slice(0, n)
    .map(
      (m, i) =>
        // The accessible name is the visible placard text; aria-pressed carries the full/returned state.
        `<li class="card" data-module="${i}"><button class="card__flip" type="button" aria-pressed="false" aria-describedby="gallery-note">` +
        `<span class="card__art" aria-hidden="true"><span class="card__state card__state--full"></span><span class="card__state card__state--returned"></span></span>` +
        `<span class="card__placard"><span class="card__name">${esc(m.product)}</span><span class="card__qty">Packed: ${esc(m.packed)}</span></span>` +
        `<span class="card__label" aria-hidden="true"><span class="card__label--full">${GALLERY_LABELS.full}</span><span class="card__label--returned">${GALLERY_LABELS.returned}</span></span>` +
        `<span class="sr-only">${GALLERY_LABELS.srHint}</span>` +
        `</button></li>`,
    )
    .join('')
}
