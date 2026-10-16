# COPY-REVIEW

Every string on the m³ page, generated from the sources by `node scripts/copy-review.ts`.
Do not edit by hand: change the source, then regenerate.

- **Draft** lines go beyond Product truth. Each is marked `<!-- DRAFT -->` in source (or listed here when generated) and needs your approval or a rewrite.
- **Truth** lines paraphrase Product truth, the brief, or a recorded decision. Please check each paraphrase against its source.
- **UI** strings are interface and accessibility labels with no claims.
- **Approved** lines were draft and are approved as written (marker `<!-- APPROVED date -->`).
- `node scripts/copy-review.ts --final` fails while any draft remains: nothing ships unapproved.

**Totals:** 0 draft · 51 approved · 69 truth/decision · 13 UI

## Draft lines (need approval)

| ID | Text | Why it's draft / notes | Where |
|---|---|---|---|


## Approved lines

| ID | Text | Approved | Notes | Where |
|---|---|---|---|---|
| `meta.description` | m³ is a modular vending machine for VMI vendors of PPE and MRO supplies. Every module is swapped at every restock and counted back at the warehouse, not on site. | 2026-10-15 | Sharing/SEO summary; paraphrases PT. | index.html:7 |
| `meta.og` | A modular vending machine for VMI vendors of PPE and MRO supplies. Swap modules on site; count at the warehouse. | 2026-10-15 | Share-card summary; paraphrases PT. | index.html:9 |
| `hero.tagline` | Swap the module. Skip the count. | 2026-10-15 | Tagline (the brief asks for "a one-line tagline"). See Alternatives. | index.html:38 |
| `hero.hint` | Scroll · watch it swap | 2026-10-15 | Playful microcopy. | index.html:41 |
| `hero.alt` | A dark, vending-machine-sized cabinet with a grid of identical doors. A cyan light line runs down the front, with one bend beside each door and a lit ring around the reader partway down. | 2026-10-15 | Text equivalent of the hero 3D. | index.html:43 |
| `how.count.caption` | Counted here, not on site. | 2026-10-15 | Decision B phrasing ("counted here, not on site"). | index.html:83 |
| `how.alt` | Animation: at the warehouse, a module is filled and closed. On site, a closed, used module slides out of its slot and a full one slides in; its light comes on. Back at the warehouse, the returned module is opened and counted. | 2026-10-15 | Text equivalent of the swap scene. | index.html:90 |
| `modular.alt` | Animation: one module slides out of its slot, the slot's fitment is highlighted for illustration, and the molded body separates into its parts. | 2026-10-15 | Text equivalent of the exploded view. The fitment highlight is illustrative, not a product light; "separates into its parts" is an illustration, not a teardown claim. | index.html:112 |
| `gallery.note` | Quantities are illustrative. Hover or tap a module to see it returned to the warehouse. | 2026-10-15 | "Quantities are illustrative" + interaction hint. | index.html:116 |
| `connected.access` | 01 · Access control Tap a badge or phone at the reader to unlock a door. Every opening is logged. | 2026-10-15 | Decision 2b: openings are logged, framed as access control. Exact wording needs approval. | index.html:131 |
| `connected.alt` | Animation: a badge taps the reader in the middle of the light line, the ring around the reader pulses, one door's light brightens, and that door swings open on its product. | 2026-10-15 | Text equivalent of the unlock scene; names the light ring. | index.html:139 |
| `background.vmi` | In vendor-managed inventory (VMI), the vendor keeps a site stocked with PPE and MRO supplies like gloves, glasses and batteries. It restocks on a schedule and bills for what was used. | 2026-10-15 | Explains VMI for newcomers (not in PT). | index.html:165 |
| `background.burden` | That usually means counting on site, item by item, at every visit, and troubleshooting machines along the way. m³ takes the count off site. Modules are swapped whole and counted back at the warehouse. | 2026-10-15 | Claims about the on-site counting/troubleshooting burden (not in PT). | index.html:166 |
| `background.inspiration` | The idea comes from airline catering. | 2026-10-15 | "The idea comes from" asserts origin. See Alternatives. | index.html:167 |
| `specs.title` | The specs. | 2026-10-15 | Section headline. | index.html:177 |
| `spec.access` | Access Badge or phone tap at the reader · openings logged | 2026-10-15 | Decision 2b wording ("openings logged"). | src/content/specs.ts:33 |
| `footer.title` | Swap in m³. | 2026-10-15 | Footer headline. | index.html:189 |
| `footer.signoff` | Made to be swapped. | 2026-10-15 | Playful microcopy. | index.html:193 |
| `placard.0` | Nitrile gloves · Packed: 100 pairs | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+1) |
| `placard.1` | Cut-resistant gloves · Packed: 24 pairs | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+2) |
| `placard.2` | Safety glasses · Packed: 36 | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+3) |
| `placard.3` | Foam earplugs · Packed: 200 pairs | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+4) |
| `placard.4` | N95 respirators · Packed: 40 | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+5) |
| `placard.5` | Hi-vis vests · Packed: 12 | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+6) |
| `placard.6` | AA batteries · Packed: 96 | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+7) |
| `placard.7` | Zip ties · Packed: 500 | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+8) |
| `placard.8` | Utility blades · Packed: 100 | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+9) |
| `placard.9` | Electrical tape · Packed: 30 rolls | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+10) |
| `placard.10` | Lens wipes · Packed: 300 | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+11) |
| `placard.11` | First-aid refills · Packed: 20 kits | 2026-10-15 | Sample placard from the brief; the quantity is an illustrative placeholder. | src/model/config.ts:100 (+12) |
| `gallery.full` | Full | 2026-10-15 | Card state label. | src/content/specs.ts:61 |
| `gallery.returned` | Returned to the warehouse | 2026-10-15 | Card state label (Decision B: consumption shown only at the warehouse). | src/content/specs.ts:61 |
| `gallery.srhint` | , show returned | 2026-10-15 | Screen-reader hint after each card name. | src/content/specs.ts:61 |
| `js.cta.title` | Contact email to be announced | 2026-10-15 | Tooltip on the CTA while the address is TBD. | src/main.ts:95 |
| `light.none` | no module | 2026-10-16 | Light-state word (Decision A / P7). | src/content/copy.ts:14 |
| `light.plugged` | plugged in | 2026-10-16 | Light-state word (PT "plugged-in status"). | src/content/copy.ts:15 |
| `light.unlocked` | unlocked | 2026-10-16 | Light-state word (Decision A / P7). | src/content/copy.ts:16 |
| `hotspot.label` | {product}, door {n}: {state} | 2026-10-16 | Accessible name of each door hotspot button. | src/content/copy.ts:18 |
| `hotspot.action.unlock` | Unlock and open | 2026-10-16 | Door cycle step 1 (demo of tap-to-unlock). | src/content/copy.ts:19 |
| `hotspot.action.pull` | Pull the module out | 2026-10-16 | Door cycle step 2 (shows the fitment). | src/content/copy.ts:20 |
| `hotspot.action.close` | Put it back and close | 2026-10-16 | Door cycle step 3. | src/content/copy.ts:21 |
| `announce.unlocked` | {product}: unlocked, door open. | 2026-10-16 | aria-live announcement. | src/content/copy.ts:22 |
| `announce.pulled` | {product}: module pulled out. The slot's fitment is visible. | 2026-10-16 | aria-live announcement. | src/content/copy.ts:23 |
| `announce.closed` | {product}: back in its slot, door closed, plugged in. | 2026-10-16 | aria-live announcement. | src/content/copy.ts:24 |
| `announce.reset` | Doors closed and view reset. | 2026-10-16 | aria-live announcement after Esc, or on leaving an interactive view, when a door was open. | src/content/copy.ts:25 |
| `controls.hint` | Drag to turn · tap a door | 2026-10-16 | Microcopy hint on the interactive views. | src/content/copy.ts:28 |
| `still.hero` | The m³ machine at a three-quarter view: a dark cabinet with a grid of doors and a cyan light line down the center. | 2026-10-16 | Alt text for the hero still (no-WebGL). | src/content/copy.ts:34 |
| `still.swap` | A closed module sliding out of its slot while the rest of the machine stays closed. | 2026-10-16 | Alt text for the swap still. | src/content/copy.ts:35 |
| `still.exploded` | A module lifted clear of its slot, the empty slot's fitment lit, and the cabinet's front frame, back, shell and base pulled apart. | 2026-10-16 | Alt text for the exploded still. | src/content/copy.ts:36 |
| `still.unlock` | A badge held to the reader in the middle of the light line, and one door open on its module. | 2026-10-16 | Alt text for the unlock still. | src/content/copy.ts:37 |
| `og.alt` | m³, a modular vending machine, shown at a three-quarter view. | 2026-10-16 | Open Graph image alt text. | src/content/copy.ts:38 |

## Alternatives offered (not used)

| For | Current | Alternative(s) |
|---|---|---|
| `hero.tagline` | Swap the module. Skip the count. | "Swap on site. Count at the warehouse." · "Full modules in. Used modules out." · "Skip the on-site count." |
| `idea.body2` | …airline catering carts are swapped whole at every turnaround… (Product truth wording) | Hedged: "…catering carts are typically swapped whole at turnaround…" (return catering exists) |
| `background.inspiration` | The idea comes from airline catering. | "It borrows from airline catering." |
| `hero.category` | A modular vending machine for VMI vendors of PPE and MRO supplies, and the sites they serve. | With the brief's novelty claim: "A new kind of modular vending machine…" (a claim; needs your approval) |

## Product truth and decision lines (check the paraphrase)

| ID | Text | Rests on | Where |
|---|---|---|---|
| `meta.title` | m³ (M-cubed) · Modular Machine Management | PT Name: "m³ … Pronounced M-cubed … Modular Machine Management" | index.html:6 |
| `meta.ogtitle` | m³ (M-cubed) · Modular Machine Management | PT Name (same as the page title) | index.html:8 |
| `nav.idea` | Idea | Brief page structure (nav) | index.html:21 |
| `nav.how` | How it works | Brief page structure (nav) | index.html:22 |
| `nav.modular` | Modular | Brief page structure (nav) | index.html:23 |
| `nav.connected` | Connected | Brief page structure (nav) | index.html:24 |
| `nav.specs` | Specs | Brief page structure (nav) | index.html:25 |
| `nav.cta` | Get in touch | Decision 10 (mailto CTA) · PLAN "Get in touch" | index.html:28 |
| `hero.title` | m³ (M-cubed) | PT Name ("m³", pronounced "M-cubed") | index.html:36 |
| `hero.caption` | M-cubed · Modular Machine Management | Brief hero: "M-cubed · Modular Machine Management" | index.html:37 |
| `hero.category` | A modular vending machine for VMI vendors of PPE and MRO supplies, and the sites they serve. | Decision D ("modular vending machine") · PT Audience: "VMI vendors — primarily of industrial PPE and MRO supplies — and the sites they serve" | index.html:39 |
| `hero.cta` | Get in touch | Decision 10 (mailto CTA) · PLAN "Get in touch" | index.html:40 |
| `idea.eyebrow` | The idea | Brief page structure | index.html:51 |
| `idea.title` | Swap, don't count. | PT "Swap, don't count (the Airplane Food Model)" | index.html:52 |
| `idea.body1` | Every module is swapped at every restock, however much was used. | PT Swap, don't count: "every module is swapped at every restock regardless of consumption" | index.html:53 |
| `idea.body2` | It's the Airplane Food Model: airline catering carts are swapped whole at every turnaround, no matter how much was eaten. | PT Swap, don't count: "airline catering carts are swapped whole at every turnaround no matter how much was eaten" (PLAN: Product truth wording by default; a hedge is offered under Alternatives) | index.html:54 |
| `how.eyebrow` | How it works | Brief page structure | index.html:65 |
| `how.title` | Load. Swap. Count. | Brief: three beats Load → Swap → Count | index.html:66 |
| `how.load.where` | 01 · At the warehouse | Brief: "Load (at the warehouse)" | index.html:69 |
| `how.load.title` | Load | Brief beat name | index.html:70 |
| `how.load.body` | Each module is filled with a set quantity, closed, and labeled with a placard naming the product inside. | PT Doors and placards: "each module is filled with a set quantity of inventory"; "a placard on its front naming the product inside" · Decision 1 (closed unit) | index.html:71 |
| `how.swap.where` | 02 · On site | Brief: "Swap (on site: full in, used out)" | index.html:74 |
| `how.swap.title` | Swap | Brief beat name | index.html:75 |
| `how.swap.body` | Full modules go in. Used modules go back to the vendor. | PT Swap, don't count: "Full modules go in; used modules go back to the vendor" | index.html:76 |
| `how.count.where` | 03 · Back at the warehouse | Brief: "Count (back at the warehouse: RMA, invoice)" | index.html:79 |
| `how.count.title` | Count | Brief beat name | index.html:80 |
| `how.count.body` | Returned modules are counted in a controlled environment. RMAs and invoices are issued as needed. | PT Connected, not counting: "consumption is determined back at the VMI vendor's warehouse, a controlled environment, where returned modules are counted and RMAs and invoices are issued as needed" | index.html:81 |
| `how.count.rma` | RMA | PT: "RMAs … are issued as needed" · Brief beat "(RMA, invoice)" | index.html:82 |
| `how.count.invoice` | Invoice | PT: "invoices are issued as needed" · Brief beat "(RMA, invoice)" | index.html:82 |
| `modular.eyebrow` | Modular by design | Brief page structure | index.html:100 |
| `modular.title` | Any module. Any slot. | Brief: "any module in any slot" | index.html:101 |
| `modular.body1` | Every slot has the same universal fitment, so modules (modular shelves) plug into any slot. | PT Modularity: "every slot has the same universal fitment; modular shelves (modules) plug in and out of any slot" | index.html:102 |
| `modular.body2` | Unloading and restocking take minimal technical expertise or troubleshooting. | PT Modularity: "Unloading and restocking take minimal technical expertise or troubleshooting" | index.html:103 |
| `modular.label.fitment` | Universal fitment The same fitment in every slot, with a low-voltage connector | PT Modularity ("the same universal fitment") · Decision 1 ("powered through the fitment's low-voltage connector") | index.html:105 |
| `modular.label.module` | Module A closed unit with its own door, placard and lock | Decision 1: "every module is a closed unit with its own door, placard, and lock" | index.html:106 |
| `modular.label.body` | Body Injection-molded plastic | PT Form: "enclosure of injection-molded plastic" | index.html:107 |
| `gallery.title` | Example modules | PLAN: gallery labeled "Example modules" | index.html:115 |
| `connected.eyebrow` | Connected, not counting | Brief page structure | index.html:127 |
| `connected.title` | Connected. Not counting. | PT "Connected, not counting" | index.html:128 |
| `connected.lede` | The internet connection does three things. | PT: "the internet connection does three things" | index.html:129 |
| `connected.status` | 02 · Plugged-in status Each slot reports whether a module is plugged in. | PT: "shelf plugged-in status" | index.html:132 |
| `connected.alerts` | 03 · Service and restock alerts Restock alerts follow your restock schedule. Service alerts flag fitment or lock faults. | PT: "service and restock alerts" · Decision 3 (restock = vendor schedule; service = fitment or lock faults) | index.html:133 |
| `connected.statement` | m³ doesn't count items. Consumption is determined back at your warehouse. | PT: "m³ intentionally does not track usage: consumption is determined back at the VMI vendor's warehouse" | index.html:135 |
| `built.eyebrow` | Built simple | Brief page structure | index.html:147 |
| `built.title` | Built simple. | Brief page structure ("Built simple") | index.html:148 |
| `built.body` | An injection-molded body and low-voltage power. Durable, yet inexpensive to make and maintain. | PT Form: "injection-molded plastic. Low-voltage powered." · PT Cost: "durable, yet inexpensive to make and maintain" | index.html:149 |
| `built.fact1` | Body Injection-molded | PT Form: injection-molded | index.html:151 |
| `built.fact2` | Power Low-voltage | PT Form: low-voltage powered | index.html:152 |
| `built.fact3` | Slots 12 universal | config.ts slot grid (computed) · PT Modularity (universal fitment) | index.html:153 |
| `background.eyebrow` | Background | Brief page structure | index.html:163 |
| `background.title` | Why m³ exists. | Brief page structure: "Background — why m³ exists" | index.html:164 |
| `specs.eyebrow` | Spec sheet | Brief page structure | index.html:176 |
| `specs.drawing` | Front elevation · approximate | Decision E (dimensions printed, marked approximate) | index.html:179 |
| `spec.dimensions` | Dimensions (H × W × D) ≈ 72 × 39 × 35 in · 1.83 × 0.99 × 0.89 m approx. | Decision 4 + E (computed from config.ts, approx.) | src/content/specs.ts:26 |
| `spec.slots` | Slots 12 (2 × 6), one universal fitment each | Decision 4 (computed from config.ts) · PT Modularity | src/content/specs.ts:31 |
| `spec.modules` | Modules One universal size · one product per module | Decision 5 (one universal size, one product per module) | src/content/specs.ts:32 |
| `spec.connected` | Connected functions Access control · plugged-in status · service and restock alerts | PT Connected: the three functions | src/content/specs.ts:34 |
| `spec.connectivity` | Connectivity type TBD | Decision 8 (TBD) | src/content/specs.ts:35 |
| `spec.power` | Power input Low-voltage TBD | Decision 8 (TBD) · PT Form "low-voltage powered" | src/content/specs.ts:36 |
| `spec.resin` | Resin Injection-molded plastic TBD | Decision 8 (TBD) · PT Form "injection-molded plastic" | src/content/specs.ts:37 |
| `spec.weight` | Weight TBD | Decision 8 (TBD) | src/content/specs.ts:38 |
| `spec.capacity` | Module capacity TBD | Decision 8 (TBD) | src/content/specs.ts:39 |
| `spec.warranty` | Warranty TBD | Decision 8 (TBD) | src/content/specs.ts:40 |
| `spec.price` | Price $15,000 retail | PT Price: "$15,000 retail" · Decision 9 (spec sheet only) | src/content/specs.ts:41 |
| `footer.cta` | Get in touch | Decision 10 (mailto CTA) | index.html:190 |
| `footer.email` | Email TBD | Decision 10 (address TBD) | index.html:190 |
| `footer.copyright` | © 2026 m³ | Brief footer: "© m³" · PLAN "© 2026 m³" | index.html:194 |
| `elevation.label` | Front elevation of m³: approximately {H} inches high and {W} inches wide, {n} slots in {cols} columns of {rows}. | Decision E (approx. dimensions) · config.ts grid | src/ui/elevation.ts:37 |
| `elevation.dims` | ≈ {in} in · {m} m | Decision E (computed from config.ts, approx.) | src/ui/elevation.ts:32 |

## UI and accessibility strings

| ID | Text | Kind | Where |
|---|---|---|---|
| `ui.skip` | Skip to content | UI label | index.html:15 |
| `nav.menu` | Menu | UI label | index.html:29 |
| `brand.label` | m³ (M-cubed) | UI / accessibility label | src/brand/wordmark.ts:211 |
| `nav.mark` | m³ (M-cubed), back to top | UI / accessibility label | index.html:18 |
| `nav.label` | Sections | UI / accessibility label | index.html:19 |
| `modular.parts` | Parts | UI / accessibility label | index.html:104 |
| `spec.caption` | m³ specifications | UI / accessibility label | src/content/specs.ts:57 |
| `ui.tbd` | TBD (read as "to be determined") | UI / accessibility label | src/content/specs.ts:48 |
| `controls.rotateLeft` | Turn the machine left | Rotate button. | src/content/copy.ts:26 |
| `controls.rotateRight` | Turn the machine right | Rotate button. | src/content/copy.ts:27 |
| `controls.region` | Interactive m³ model | Label for the model controls region. | src/content/copy.ts:29 |
| `loader.label` | Loading m³ | Loader accessible label. | src/content/copy.ts:31 |
| `loader.skip` | Skip intro | Loader skip control. | src/content/copy.ts:32 |
