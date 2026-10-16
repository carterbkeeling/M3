// JS-only strings: announcements, hotspot and control labels, captions the page writes at runtime.
// Each has a stable ID and a status, and scripts/copy-review.ts lists them in COPY-REVIEW.md.
// New wording starts as 'draft' (it ships only after approval: check:copy --final fails on drafts).

export interface CopyEntry {
  text: string
  status: 'draft' | 'approved' | 'ui'
  note: string
  approved?: string
}

export const COPY = {
  // Status lights, said in words (Decision A). Brightness alone never carries the state.
  'light.none': { text: 'no module', status: 'approved', approved: '2026-10-16', note: 'Light-state word (Decision A / P7).' },
  'light.plugged': { text: 'plugged in', status: 'approved', approved: '2026-10-16', note: 'Light-state word (PT "plugged-in status").' },
  'light.unlocked': { text: 'unlocked', status: 'approved', approved: '2026-10-16', note: 'Light-state word (Decision A / P7).' },
  // Door hotspots (keyboard and screen readers). {product} and {state} are filled at runtime.
  'hotspot.label': { text: '{product}, door {n}: {state}', status: 'approved', approved: '2026-10-16', note: 'Accessible name of each door hotspot button.' },
  'hotspot.action.unlock': { text: 'Unlock and open', status: 'approved', approved: '2026-10-16', note: 'Door cycle step 1 (demo of tap-to-unlock).' },
  'hotspot.action.pull': { text: 'Pull the module out', status: 'approved', approved: '2026-10-16', note: 'Door cycle step 2 (shows the fitment).' },
  'hotspot.action.close': { text: 'Put it back and close', status: 'approved', approved: '2026-10-16', note: 'Door cycle step 3.' },
  'announce.unlocked': { text: '{product}: unlocked, door open.', status: 'approved', approved: '2026-10-16', note: 'aria-live announcement.' },
  'announce.pulled': { text: '{product}: module pulled out. The slot\'s fitment is visible.', status: 'approved', approved: '2026-10-16', note: 'aria-live announcement.' },
  'announce.closed': { text: '{product}: back in its slot, door closed, plugged in.', status: 'approved', approved: '2026-10-16', note: 'aria-live announcement.' },
  'announce.reset': { text: 'Doors closed and view reset.', status: 'approved', approved: '2026-10-16', note: 'aria-live announcement after Esc, or on leaving an interactive view, when a door was open.' },
  'controls.rotateLeft': { text: 'Turn the machine left', status: 'ui', note: 'Rotate button.' },
  'controls.rotateRight': { text: 'Turn the machine right', status: 'ui', note: 'Rotate button.' },
  'controls.hint': { text: 'Drag to turn · tap a door', status: 'approved', approved: '2026-10-16', note: 'Microcopy hint on the interactive views.' },
  'controls.region': { text: 'Interactive m³ model', status: 'ui', note: 'Label for the model controls region.' },
  // Loader
  'loader.label': { text: 'Loading m³', status: 'ui', note: 'Loader accessible label.' },
  'loader.skip': { text: 'Skip intro', status: 'ui', note: 'Loader skip control.' },
  // Stills (no-WebGL path) alt text
  'still.hero': { text: 'The m³ machine at a three-quarter view: a dark cabinet with a grid of doors and a cyan light line down the center.', status: 'approved', approved: '2026-10-16', note: 'Alt text for the hero still (no-WebGL).' },
  'still.swap': { text: 'A closed module sliding out of its slot while the rest of the machine stays closed.', status: 'approved', approved: '2026-10-16', note: 'Alt text for the swap still.' },
  'still.exploded': { text: "A module lifted clear of its slot, the empty slot's fitment lit, and the cabinet's front frame, back, shell and base pulled apart.", status: 'approved', approved: '2026-10-16', note: 'Alt text for the exploded still.' },
  'still.unlock': { text: 'A badge held to the reader in the middle of the light line, and one door open on its module.', status: 'approved', approved: '2026-10-16', note: 'Alt text for the unlock still.' },
  'og.alt': { text: 'm³, a modular vending machine, shown at a three-quarter view.', status: 'approved', approved: '2026-10-16', note: 'Open Graph image alt text.' },
} satisfies Record<string, CopyEntry>

export type CopyId = keyof typeof COPY

export function t(id: CopyId, vars: Record<string, string | number> = {}): string {
  return COPY[id].text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
