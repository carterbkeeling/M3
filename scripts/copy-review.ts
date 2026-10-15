// Builds COPY-REVIEW.md from the sources: every string on the page with its copy ID, status, the
// Product truth line or decision it rests on, and where it lives. Run: node scripts/copy-review.ts
// With --check it exits non-zero if a page string has no text or a truth line has no source.
import { readFileSync, writeFileSync } from 'node:fs'
import { config } from '../src/model/config.ts'
import { expandBlocks } from '../src/content/blocks.ts'
import { GALLERY_LABELS } from '../src/content/specs.ts'
import { WORDMARK_LABEL } from '../src/brand/wordmark.ts'

type Status = 'draft' | 'truth' | 'ui'
interface Entry {
  id: string
  text: string
  status: Status
  source: string
  where: string
}

// What each non-draft line rests on: a Product truth line (PT), the brief, or a recorded decision.
const SOURCES: Record<string, string> = {
  'meta.title': 'PT Name: "m³ … Pronounced M-cubed … Modular Machine Management"',
  'meta.ogtitle': 'PT Name (same as the page title)',
  'nav.idea': 'Brief page structure (nav)',
  'nav.how': 'Brief page structure (nav)',
  'nav.modular': 'Brief page structure (nav)',
  'nav.connected': 'Brief page structure (nav)',
  'nav.specs': 'Brief page structure (nav)',
  'nav.cta': 'Decision 10 (mailto CTA) · PLAN "Get in touch"',
  'hero.title': 'PT Name ("m³", pronounced "M-cubed")',
  'hero.caption': 'Brief hero: "M-cubed · Modular Machine Management"',
  'hero.category': 'Decision D ("modular vending machine") · PT Audience: "VMI vendors — primarily of industrial PPE and MRO supplies — and the sites they serve"',
  'hero.cta': 'Decision 10 (mailto CTA) · PLAN "Get in touch"',
  'idea.eyebrow': 'Brief page structure',
  'idea.title': 'PT "Swap, don\'t count (the Airplane Food Model)"',
  'idea.body1': 'PT Swap, don\'t count: "every module is swapped at every restock regardless of consumption"',
  'idea.body2': 'PT Swap, don\'t count: "airline catering carts are swapped whole at every turnaround no matter how much was eaten" (PLAN: Product truth wording by default; a hedge is offered under Alternatives)',
  'how.eyebrow': 'Brief page structure',
  'how.title': 'Brief: three beats Load → Swap → Count',
  'how.load.where': 'Brief: "Load (at the warehouse)"',
  'how.load.title': 'Brief beat name',
  'how.load.body': 'PT Doors and placards: "each module is filled with a set quantity of inventory"; "a placard on its front naming the product inside" · Decision 1 (closed unit)',
  'how.swap.where': 'Brief: "Swap (on site: full in, used out)"',
  'how.swap.title': 'Brief beat name',
  'how.swap.body': 'PT Swap, don\'t count: "Full modules go in; used modules go back to the vendor"',
  'how.count.where': 'Brief: "Count (back at the warehouse: RMA, invoice)"',
  'how.count.title': 'Brief beat name',
  'how.count.body': 'PT Connected, not counting: "consumption is determined back at the VMI vendor\'s warehouse, a controlled environment, where returned modules are counted and RMAs and invoices are issued as needed"',
  'how.count.rma': 'PT: "RMAs … are issued as needed" · Brief beat "(RMA, invoice)"',
  'how.count.invoice': 'PT: "invoices are issued as needed" · Brief beat "(RMA, invoice)"',
  'modular.eyebrow': 'Brief page structure',
  'modular.title': 'Brief: "any module in any slot"',
  'modular.body1': 'PT Modularity: "every slot has the same universal fitment; modular shelves (modules) plug in and out of any slot"',
  'modular.body2': 'PT Modularity: "Unloading and restocking take minimal technical expertise or troubleshooting"',
  'modular.label.fitment': 'PT Modularity ("the same universal fitment") · Decision 1 ("powered through the fitment\'s low-voltage connector")',
  'modular.label.module': 'Decision 1: "every module is a closed unit with its own door, placard, and lock"',
  'modular.label.body': 'PT Form: "enclosure of injection-molded plastic"',
  'gallery.title': 'PLAN: gallery labeled "Example modules"',
  'connected.eyebrow': 'Brief page structure',
  'connected.title': 'PT "Connected, not counting"',
  'connected.lede': 'PT: "the internet connection does three things"',
  'connected.status': 'PT: "shelf plugged-in status"',
  'connected.alerts': 'PT: "service and restock alerts" · Decision 3 (restock = vendor schedule; service = fitment or lock faults)',
  'connected.statement': 'PT: "m³ intentionally does not track usage: consumption is determined back at the VMI vendor\'s warehouse"',
  'built.eyebrow': 'Brief page structure',
  'built.title': 'Brief page structure ("Built simple")',
  'built.body': 'PT Form: "injection-molded plastic. Low-voltage powered." · PT Cost: "durable, yet inexpensive to make and maintain"',
  'built.fact1': 'PT Form: injection-molded',
  'built.fact2': 'PT Form: low-voltage powered',
  'built.fact3': 'config.ts slot grid (computed) · PT Modularity (universal fitment)',
  'background.eyebrow': 'Brief page structure',
  'background.title': 'Brief page structure: "Background — why m³ exists"',
  'specs.eyebrow': 'Brief page structure',
  'specs.drawing': 'Decision E (dimensions printed, marked approximate)',
  'footer.cta': 'Decision 10 (mailto CTA)',
  'footer.email': 'Decision 10 (address TBD)',
  'footer.copyright': 'Brief footer: "© m³" · PLAN "© 2026 m³"',
  'spec.dimensions': 'Decision 4 + E (computed from config.ts, approx.)',
  'spec.slots': 'Decision 4 (computed from config.ts) · PT Modularity',
  'spec.modules': 'Decision 5 (one universal size, one product per module)',
  'spec.connected': 'PT Connected: the three functions',
  'spec.connectivity': 'Decision 8 (TBD)',
  'spec.power': 'Decision 8 (TBD) · PT Form "low-voltage powered"',
  'spec.resin': 'Decision 8 (TBD) · PT Form "injection-molded plastic"',
  'spec.weight': 'Decision 8 (TBD)',
  'spec.capacity': 'Decision 8 (TBD)',
  'spec.warranty': 'Decision 8 (TBD)',
  'spec.price': 'PT Price: "$15,000 retail" · Decision 9 (spec sheet only)',
}

// Why a draft line is draft, and anything the reviewer should weigh.
const DRAFT_NOTES: Record<string, string> = {
  'meta.description': 'Sharing/SEO summary; paraphrases PT.',
  'meta.og': 'Share-card summary; paraphrases PT.',
  'hero.tagline': 'Tagline (the brief asks for "a one-line tagline"). See Alternatives.',
  'hero.hint': 'Playful microcopy.',
  'hero.alt': 'Text equivalent of the hero 3D.',
  'how.count.caption': 'Decision B phrasing ("counted here, not on site").',
  'how.alt': 'Text equivalent of the swap scene.',
  'modular.alt': 'Text equivalent of the exploded view. The fitment highlight is illustrative, not a product light; "separates into its parts" is an illustration, not a teardown claim.',
  'gallery.note': '"Quantities are illustrative" + interaction hint.',
  'connected.access': 'Decision 2b: openings are logged, framed as access control. Exact wording needs approval.',
  'connected.alt': 'Text equivalent of the unlock scene; names the light ring.',
  'background.vmi': 'Explains VMI for newcomers (not in PT).',
  'background.burden': 'Claims about the on-site counting/troubleshooting burden (not in PT).',
  'background.inspiration': '"The idea comes from" asserts origin. See Alternatives.',
  'specs.title': 'Section headline.',
  'footer.title': 'Footer headline.',
  'footer.signoff': 'Playful microcopy.',
  'spec.access': 'Decision 2b wording ("openings logged").',
}

const read = (p: string) => readFileSync(p, 'utf8')
const lineIn = (file: string, needle: string) => {
  const i = read(file).indexOf(needle)
  return i < 0 ? file : `${file}:${read(file).slice(0, i).split('\n').length}`
}

// Expand build-time blocks first (one line each, so line numbers stay true).
const html = expandBlocks(read('index.html'))
const lineOf = (index: number) => html.slice(0, index).split('\n').length

const stripTags = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<\/(dt|dd|li|p|h[1-6]|div|th|td)>|<br\s*\/?>/gi, ' ')
    .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const entries: Entry[] = []
const re = /data-copy="([^"]+)"/g
let m: RegExpExecArray | null
while ((m = re.exec(html))) {
  const id = m[1]
  const tagStart = html.lastIndexOf('<', m.index)
  const tagName = /^<([a-z0-9]+)/i.exec(html.slice(tagStart))![1]
  const openEnd = html.indexOf('>', m.index)
  const openTag = html.slice(tagStart, openEnd + 1)
  let text = ''
  let after = openEnd + 1
  if (/\/>$/.test(openTag) || tagName === 'meta') {
    text = /content="([^"]*)"/.exec(openTag)?.[1] ?? ''
  } else {
    let depth = 1
    const tagRe = new RegExp(`<(/?)${tagName}\\b[^>]*>`, 'gi')
    tagRe.lastIndex = openEnd + 1
    let t: RegExpExecArray | null
    while ((t = tagRe.exec(html))) {
      depth += t[1] ? -1 : 1
      if (depth === 0) {
        text = stripTags(html.slice(openEnd + 1, t.index))
        after = t.index + t[0].length
        break
      }
    }
  }
  const draft = /^\s*<!-- DRAFT -->/.test(html.slice(after, after + 40))
  const isUi = id.startsWith('ui.') || id === 'nav.menu'
  entries.push({
    id,
    text,
    status: draft ? 'draft' : isUi ? 'ui' : 'truth',
    source: draft ? (DRAFT_NOTES[id] ?? '') : isUi ? 'UI label' : (SOURCES[id] ?? ''),
    where: id.startsWith('spec.') ? lineIn('src/content/specs.ts', `id: '${id.slice(5)}'`) : `index.html:${lineOf(m.index)}`,
  })
}

// Generated content that has no data-copy of its own.
const modulesLine = lineIn('src/model/config.ts', 'modules: [')
config.modules.slice(0, config.grid.cols * config.grid.rows).forEach((mod, i) => {
  entries.push({
    id: `placard.${i}`,
    text: `${mod.product} · Packed: ${mod.packed}`,
    status: 'draft',
    source: 'Sample placard from the brief; the quantity is an illustrative placeholder.',
    where: `${modulesLine} (+${i + 1})`,
  })
})
entries.push(
  { id: 'gallery.full', text: GALLERY_LABELS.full, status: 'draft', source: 'Card state label.', where: lineIn('src/content/specs.ts', 'GALLERY_LABELS =') },
  { id: 'gallery.returned', text: GALLERY_LABELS.returned, status: 'draft', source: 'Card state label (Decision B: consumption shown only at the warehouse).', where: lineIn('src/content/specs.ts', 'GALLERY_LABELS =') },
  { id: 'gallery.srhint', text: GALLERY_LABELS.srHint, status: 'draft', source: 'Screen-reader hint after each card name.', where: lineIn('src/content/specs.ts', 'GALLERY_LABELS =') },
  { id: 'elevation.label', text: 'Front elevation of m³: approximately {H} inches high and {W} inches wide, {n} slots in {cols} columns of {rows}.', status: 'truth', source: 'Decision E (approx. dimensions) · config.ts grid', where: lineIn('src/ui/elevation.ts', 'aria-label') },
  { id: 'elevation.dims', text: '≈ {in} in · {m} m', status: 'truth', source: 'Decision E (computed from config.ts, approx.)', where: lineIn('src/ui/elevation.ts', 'const dimH') },
  { id: 'js.cta.title', text: 'Contact email to be announced', status: 'draft', source: 'Tooltip on the CTA while the address is TBD.', where: lineIn('src/main.ts', 'Contact email to be announced') },
)
// Accessibility and UI strings outside data-copy elements.
const ui: Array<[string, string, string]> = [
  ['brand.label', WORDMARK_LABEL, lineIn('src/brand/wordmark.ts', 'WORDMARK_LABEL =')],
  ['nav.mark', 'm³ (M-cubed), back to top', lineIn('index.html', 'back to top')],
  ['nav.label', 'Sections', lineIn('index.html', 'aria-label="Sections"')],
  ['modular.parts', 'Parts', lineIn('index.html', 'aria-label="Parts"')],
  ['spec.caption', 'm³ specifications', lineIn('src/content/specs.ts', 'm³ specifications')],
  ['ui.tbd', 'TBD (read as "to be determined")', lineIn('src/content/specs.ts', 'to be determined')],
]
for (const [id, text, where] of ui) entries.push({ id, text, status: 'ui', source: 'UI / accessibility label', where })

const missingSource = entries.filter((e) => e.status === 'truth' && !e.source)
const emptyText = entries.filter((e) => !e.text)

const cell = (s: string) => s.replace(/\|/g, '\\|')
const row = (e: Entry) => `| \`${e.id}\` | ${cell(e.text)} | ${cell(e.source)} | ${e.where} |`
const drafts = entries.filter((e) => e.status === 'draft')
const truths = entries.filter((e) => e.status === 'truth')
const uis = entries.filter((e) => e.status === 'ui')

const md = `# COPY-REVIEW

Every string on the m³ page, generated from the sources by \`node scripts/copy-review.ts\`.
Do not edit by hand: change the source, then regenerate.

- **Draft** lines go beyond Product truth. Each is marked \`<!-- DRAFT -->\` in source (or listed here when generated) and needs your approval or a rewrite.
- **Truth** lines paraphrase Product truth, the brief, or a recorded decision. Please check each paraphrase against its source.
- **UI** strings are interface and accessibility labels with no claims.
- Once a line is approved, Phase 3 marks it approved; at sign-off no draft may remain.

**Totals:** ${drafts.length} draft · ${truths.length} truth/decision · ${uis.length} UI${missingSource.length ? ` · ⚠ ${missingSource.length} truth lines missing a source` : ''}

## Draft lines (need approval)

| ID | Text | Why it's draft / notes | Where |
|---|---|---|---|
${drafts.map(row).join('\n')}

## Alternatives offered

| For | Current | Alternative(s) |
|---|---|---|
| \`hero.tagline\` | Swap the module. Skip the count. | "Swap on site. Count at the warehouse." · "Full modules in. Used modules out." · "Skip the on-site count." |
| \`idea.body2\` | …airline catering carts are swapped whole at every turnaround… (Product truth wording) | Hedged: "…catering carts are typically swapped whole at turnaround…" (return catering exists) |
| \`background.inspiration\` | The idea comes from airline catering. | "It borrows from airline catering." |
| \`hero.category\` | A modular vending machine for VMI vendors of PPE and MRO supplies, and the sites they serve. | With the brief's novelty claim: "A new kind of modular vending machine…" (a claim; needs your approval) |

## Product truth and decision lines (check the paraphrase)

| ID | Text | Rests on | Where |
|---|---|---|---|
${truths.map(row).join('\n')}

## UI and accessibility strings

| ID | Text | Kind | Where |
|---|---|---|---|
${uis.map(row).join('\n')}

## Not on the page yet
- Module and scene stills, OG image alt text: Phase 3.
- Light-state captions and aria-live announcements ("no module" / "plugged in" / "unlocked"): Phase 3 (draft).
`

writeFileSync('COPY-REVIEW.md', md)
console.log(`COPY-REVIEW.md: ${drafts.length} draft, ${truths.length} truth/decision, ${uis.length} UI, ${missingSource.length} missing source, ${emptyText.length} empty`)
if (process.argv.includes('--check') && (missingSource.length || emptyText.length)) {
  for (const e of [...missingSource, ...emptyText]) console.error(`  ${e.id} (${e.where})`)
  process.exit(1)
}
