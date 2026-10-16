// How the machine sits on screen in each section. The stage blends between framings as section
// boundaries cross mid-screen. yaw/pitch turn the machine (negative yaw shows its right side);
// screenX/screenY place its center as a fraction of the viewport (+x right, +y up);
// dist is camera distance in meters; lookY is the height on the machine the camera aims at.
// The spec sheet is the exception: there the stage switches to an orthographic camera registered
// to the elevation drawing (see stage.ts).

export interface Framing {
  yaw: number
  pitch: number
  dist: number
  lookY: number
  screenX: number
  screenY: number
  opacity: number
}

type Table = Record<string, Framing>

const hidden = (f: Framing): Framing => ({ ...f, opacity: 0 })

const desktopBase: Table = {
  top: { yaw: -0.5, pitch: 0.1, dist: 5.4, lookY: 0.95, screenX: 0.17, screenY: 0, opacity: 1 },
  idea: { yaw: -0.28, pitch: 0.06, dist: 6.4, lookY: 0.92, screenX: 0.25, screenY: 0, opacity: 1 },
  how: { yaw: -0.18, pitch: 0.08, dist: 5.8, lookY: 0.95, screenX: 0.22, screenY: 0, opacity: 1 },
  modular: { yaw: 0.5, pitch: 0.12, dist: 5.7, lookY: 0.92, screenX: -0.23, screenY: 0, opacity: 1 },
  connected: { yaw: -0.14, pitch: 0.04, dist: 5.2, lookY: 0.9, screenX: 0.26, screenY: 0, opacity: 1 },
  built: { yaw: 0.62, pitch: 0.14, dist: 5.6, lookY: 0.92, screenX: -0.22, screenY: 0, opacity: 1 },
  specs: { yaw: 0, pitch: 0, dist: 7, lookY: 0.92, screenX: -0.25, screenY: 0, opacity: 1 },
}
// The free views (hero, Built simple) sit a little smaller and higher on desktop, so the turn controls
// fit just under the machine, down to 720 px tall, instead of over its plinth. (Phones place the
// controls on the plinth, so they keep the base framing.)
const desktopTop: Framing = { ...desktopBase.top, dist: 5.9, screenY: 0.04 }
const desktopBuilt: Framing = { ...desktopBase.built, dist: 5.9, screenY: 0.035 }
const desktop: Table = {
  ...desktopBase,
  top: desktopTop,
  built: desktopBuilt,
  gallery: hidden(desktopBase.modular),
  background: hidden(desktopBuilt),
  contact: hidden(desktopBase.specs),
}

// Phones: the machine owns the top of the screen, centered.
const mobileBase: Table = Object.fromEntries(
  Object.entries(desktopBase).map(([k, f]) => [k, { ...f, screenX: 0, screenY: 0.24, dist: f.dist * 1.95 }]),
)
mobileBase.top = { ...mobileBase.top, screenY: 0.21, dist: desktopBase.top.dist * 1.8 }
mobileBase.how = { ...mobileBase.how, dist: 4.8 * 1.95 }
// The two scenes with the most copy: a smaller machine, higher up, so the copy below stays clear.
mobileBase.modular = { ...mobileBase.modular, screenY: 0.29, dist: desktopBase.modular.dist * 2.5 }
mobileBase.connected = { ...mobileBase.connected, screenY: 0.29, dist: desktopBase.connected.dist * 2.4 }
const mobile: Table = {
  ...mobileBase,
  gallery: hidden(mobileBase.modular),
  background: hidden(mobileBase.built),
  contact: hidden(mobileBase.specs),
}

// While a door stands open in a free view, the machine turns to face the visitor (all but square: a
// sliver of the right side keeps the pulled module's depth readable) and moves a little further from
// the copy (desktop only: on phones it is centered, so it stays put). The open door and the pulled
// module then come out toward the camera instead of across the hero wordmark. k: how far into that
// pose it is (0 → 1).
const PRESENT = { yaw: -0.1, shift: 0.06 }
export function presentFraming(f: Framing, k: number): Framing {
  if (k <= 0) return f
  return { ...f, yaw: f.yaw + (PRESENT.yaw - f.yaw) * k, screenX: f.screenX + Math.sign(f.screenX) * PRESENT.shift * k }
}

export function framingFor(id: string, isMobile: boolean): Framing {
  const t = isMobile ? mobile : desktop
  return t[id] ?? t.top
}

export function mixFraming(a: Framing, b: Framing, t: number): Framing {
  const m = (x: number, y: number) => x + (y - x) * t
  return {
    yaw: m(a.yaw, b.yaw),
    pitch: m(a.pitch, b.pitch),
    dist: m(a.dist, b.dist),
    lookY: m(a.lookY, b.lookY),
    screenX: m(a.screenX, b.screenX),
    screenY: m(a.screenY, b.screenY),
    opacity: m(a.opacity, b.opacity),
  }
}
