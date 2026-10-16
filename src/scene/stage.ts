import * as THREE from 'three'
import { config } from '../model/config.ts'
import { buildMachine } from '../model/buildMachine.ts'
import { setDefaultMaterialTier } from '../model/materials.ts'
import { applyPlacards } from '../model/placardAtlas.ts'
import { createContactShadow, setupLighting } from './lighting.ts'
import { boundaryBlend, getSections, stickyProgress } from '../ui/scrollMap.ts'
import { ELEVATION_PAD } from '../ui/elevation.ts'
import { framingFor, mixFraming, presentFraming, type Framing } from './framings.ts'
import { createInteraction } from './interaction.ts'
import { explodedScene, swapScene, unlockScene, type Scene } from './scenes.ts'

// The 3D stage: one renderer, one fixed canvas behind the content, one machine. The camera has a
// single owner (this file); scroll position picks the framing, scenes pose the machine, and the
// cursor adds a small clamped tilt in the hero. Interaction (drag, doors, keyboard hotspots) adds
// a clamped yaw offset and per-door state on top, only in the views meant for it, and while a door
// stands open the framing eases to face the visitor.

export interface Stage {
  frame(scrollY: number, time: number): void
  resize(): void
}

// Sections where the visitor can drive the machine freely (no scroll scene is posing it).
const FREE = new Set(['top', 'built'])
// Reduced motion: scroll scenes don't scrub; each beat is a held framing, cut as you scroll.
const BEAT_HOLDS: Record<string, Array<[number, number]>> = {
  swap: [[0.33, 0.16], [0.7, 0.5], [1.01, 0.84]],
  exploded: [[0.42, 0.3], [0.86, 0.6], [1.01, 1]],
  unlock: [[0.3, 0.2], [0.9, 0.62], [1.01, 1]], // first hold: the badge on the reader, ring lit
}
const MAX_PIXELS = 3.7e6

export function startStage(host: HTMLElement, opts: { reducedMotion: boolean }): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.setClearColor(0x000000, 0)
  // Production skips shader info-log reads: faster startup, and the GPU driver's benign compiler
  // notes (e.g. D3D X4122 on this laptop) don't reach the console.
  renderer.debug.checkShaderErrors = import.meta.env.DEV
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const lighting = setupLighting(scene, renderer)

  // Weaker GPUs (phones, coarse pointers) get the standard-material tier: same colors and grain,
  // no clearcoat or sheen.
  setDefaultMaterialTier(window.matchMedia('(pointer: coarse)').matches ? 'standard' : 'high')
  const machine = buildMachine(config)
  const rig = new THREE.Group()
  rig.add(machine.root)
  scene.add(rig)
  // Part of the machine, so it leaves the stage with it (warehouse beats).
  machine.root.add(createContactShadow(machine))
  // Placard text: drawn into one atlas once the webfonts are in (redrawn if they land late). Each
  // draw asks for a frame, since the page may be idle.
  void applyPlacards(machine, renderer, { onDraw: () => (dirty = true) })

  const BASE_FOV = 24
  const DOLLY_FOV = 2
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 60)
  // Spec sheet: an orthographic front view registered to the elevation drawing's outline.
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 60)
  const elevation = document.querySelector<SVGSVGElement>('.elevation')
  const elevationBody = elevation?.querySelector<SVGGElement>('.elevation__body') ?? null
  const L = machine.layout
  const mm = (m: number) => Math.round(m * 1000)

  function registerOrtho(): boolean {
    if (!elevation) return false
    const vb = elevation.viewBox.baseVal
    const r = elevation.getBoundingClientRect()
    if (!vb || !r.width || !r.height) return false
    const k = Math.min(r.width / vb.width, r.height / vb.height) // px per drawing unit (mm)
    const ox = r.left + (r.width - vb.width * k) / 2
    const oy = r.top + (r.height - vb.height * k) / 2
    const pxPerM = k * 1000
    const cx = ox + (ELEVATION_PAD + mm(L.W) / 2) * k
    const cy = oy + (ELEVATION_PAD + mm(L.H) / 2) * k
    ortho.left = -w / 2 / pxPerM
    ortho.right = w / 2 / pxPerM
    ortho.top = h / 2 / pxPerM
    ortho.bottom = -h / 2 / pxPerM
    ortho.position.set(-(cx - w / 2) / pxPerM, L.H / 2 + (cy - h / 2) / pxPerM, 10)
    ortho.rotation.set(0, 0, 0)
    ortho.updateProjectionMatrix()
    return true
  }

  // The drawing's own outline (hidden by the stylesheet while the live machine stands in for it):
  // an opacity, or null to hand it back to the stylesheet.
  let bodyOpacity: string | null = null
  function setElevationBody(o: number | null) {
    const next = o === null ? null : o.toFixed(3)
    if (!elevationBody || next === bodyOpacity) return
    bodyOpacity = next
    if (next === null) elevationBody.style.removeProperty('opacity')
    else elevationBody.style.opacity = next
  }

  // Spec sheet handoff, a dolly-zoom: the perspective camera narrows from its normal field of view to
  // about 2° while backing away, keeping the machine's front face registered to the drawing the whole
  // way, so only the perspective flattens. At the end the orthographic camera takes over with the
  // same image. Needs registerOrtho() first (it supplies the drawing's center and scale).
  function dolly(k: number) {
    const e = k * k * (3 - 2 * k)
    const fov = BASE_FOV * Math.pow(DOLLY_FOV / BASE_FOV, e)
    const d = ortho.top / Math.tan(THREE.MathUtils.degToRad(fov / 2)) // ortho.top: half the visible height, in m
    camera.fov = fov
    camera.near = Math.max(0.05, d - L.D)
    camera.far = d + L.D + 2
    camera.clearViewOffset() // also updates the projection
    camera.position.set(ortho.position.x, ortho.position.y, L.D / 2 + d)
    camera.rotation.set(0, 0, 0)
    camera.updateMatrixWorld()
  }

  // Scenes keyed by the element that scrolls them.
  const scenes: Array<{ el: HTMLElement; scene: Scene }> = []
  const add = (sel: string, scene: Scene) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) scenes.push({ el, scene })
  }
  const cols = config.grid.cols
  const midRow = Math.max(0, Math.round(config.grid.rows / 2) - 1)
  add('[data-scene="swap"]', swapScene(machine, Math.min(machine.slots.length - 1, midRow * cols + cols - 1)))
  add('[data-scene="exploded"]', explodedScene(machine, Math.min(machine.slots.length - 1, cols * Math.max(0, midRow - 1))))
  add('[data-scene="unlock"]', unlockScene(machine, Math.min(machine.slots.length - 1, (midRow + 1) * cols)))

  const interaction = createInteraction(machine, { reducedMotion: opts.reducedMotion })

  // ?debug: frame readout over the last 120 frames: the frame interval (vsync-bound, so ~16.7 ms at
  // 60 Hz with jitter), the CPU work per frame (scene update plus draw submission; the GPU runs after,
  // asynchronously) and the dropped frames (intervals over 1.5× the median).
  const debug = new URLSearchParams(location.search).has('debug') ? document.createElement('output') : null
  const frameTimes: number[] = []
  const workTimes: number[] = []
  let lastTime = 0
  if (debug) {
    debug.className = 'debug-fps'
    document.body.append(debug)
  }

  // Cursor tilt (hero only), smoothed.
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  })

  // Render on demand: the hero idles (drift and cursor tilt) and always renders; elsewhere a frame is
  // drawn only while the page scrolls or the visitor interacts (plus a short tail), while the
  // interaction still has something moving (plus one frame to land its final values), and once after
  // anything else asks for one (a placard atlas draw).
  let lastScroll = -1
  let lastInput = 0
  let dirty = true
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchmove'] as const) {
    window.addEventListener(ev, () => (lastInput = performance.now()), { passive: true })
  }
  let heroOnScreen = true

  let w = 1
  let h = 1
  let isMobile = false
  function resize() {
    lastInput = performance.now()
    w = window.innerWidth
    h = window.innerHeight
    isMobile = w < 900
    // Pixel ratio capped at 2 and at ~3.7 MP rendered, so 2560 px screens don't melt laptops.
    renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio, 2, Math.sqrt(MAX_PIXELS / (w * h)))))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  // Compile every shader before the first frame (no hitch on first scroll); the canvas stays clear
  // until then.
  let compiled = false
  renderer.compileAsync(scene, camera).finally(() => {
    compiled = true
    lastInput = performance.now()
  })

  function frame(scrollY: number, time: number) {
    const sections = getSections()
    if (!sections.length || !compiled) return
    const busy = interaction.busy()
    const changed = dirty || busy || scrollY !== lastScroll || time - lastInput < 1600 || heroOnScreen || debug !== null
    dirty = busy
    lastScroll = scrollY
    if (!changed) return
    if (!debug) return draw(sections, scrollY, time)
    const t0 = performance.now()
    draw(sections, scrollY, time)
    const push = (list: number[], v: number) => {
      list.push(v)
      if (list.length > 120) list.shift()
    }
    push(workTimes, performance.now() - t0)
    if (lastTime) push(frameTimes, time - lastTime)
    lastTime = time
    const q = (list: number[], k: number) => {
      const sorted = [...list].sort((x, y) => x - y)
      return sorted[Math.min(sorted.length - 1, Math.floor(k * sorted.length))] ?? 0
    }
    const median = q(frameTimes, 0.5) || 16.7
    const drops = frameTimes.filter((x) => x > median * 1.5).length
    debug.textContent =
      `frame ${median.toFixed(1)} ms · p95 ${q(frameTimes, 0.95).toFixed(1)} · work p95 ${q(workTimes, 0.95).toFixed(1)} ms · drops ${drops}/${frameTimes.length}`
  }

  function draw(sections: ReturnType<typeof getSections>, scrollY: number, time: number) {
    const [a, b, tRaw] = boundaryBlend(scrollY, h)
    const t = opts.reducedMotion ? (tRaw < 0.5 ? 0 : 1) : tRaw
    let f: Framing = mixFraming(framingFor(sections[a].id, isMobile), framingFor(sections[b].id, isMobile), t)
    // Lighting follows the tone behind the machine (rim and floor glow lift on dark sections).
    if (sections[a].tone === sections[b].tone) lighting.setTone(sections[b].tone, 1)
    else lighting.setTone(sections[b].tone, t)

    let extraDist = 0
    let extraLook = 0
    for (const { el, scene } of scenes) {
      let p = stickyProgress(el, scrollY, h)
      const holds = opts.reducedMotion ? BEAT_HOLDS[el.dataset.scene ?? ''] : undefined
      if (holds && p > 0 && p < 1) p = holds.find(([until]) => p < until)?.[1] ?? p
      scene.apply(p)
      const c = scene.camera?.(p)
      if (c && p > 0 && p < 1) {
        extraDist += c[0]
        extraLook += c[1]
      }
    }

    // A door open in a free view: the machine turns to face the visitor (see presentFraming).
    const present = interaction.present()
    f = presentFraming(f, present)

    // Hero: slow idle drift plus a gentle tilt toward the cursor (fades out as the hero leaves, and
    // holds still while the machine presents an open door).
    const heroWeight = a === 0 ? 1 - t : 0
    heroOnScreen = heroWeight > 0 && !opts.reducedMotion
    pointer.sx += (pointer.x - pointer.sx) * 0.07
    pointer.sy += (pointer.y - pointer.sy) * 0.07
    const sway = heroWeight * (1 - present)
    const drift = opts.reducedMotion ? 0 : Math.sin(time * 0.00025) * 0.06
    const yaw = f.yaw + sway * (drift + (opts.reducedMotion ? 0 : pointer.sx * 0.1))
    const pitch = f.pitch + sway * (opts.reducedMotion ? 0 : -pointer.sy * 0.05)

    f = { ...f, dist: f.dist + extraDist, lookY: f.lookY + extraLook }
    const currentSection = sections[t < 0.5 ? a : b]
    const current = currentSection.id
    const free = FREE.has(current) && (a === b || tRaw < 0.15 || tRaw > 0.85)
    rig.rotation.y = yaw + interaction.yawOffset()
    if (camera.fov !== BASE_FOV) {
      camera.fov = BASE_FOV
      camera.near = 0.05
      camera.far = 60
    }
    camera.position.set(0, f.lookY + Math.sin(pitch) * f.dist, Math.cos(pitch) * f.dist)
    camera.lookAt(0, f.lookY, 0)
    camera.setViewOffset(w, h, -f.screenX * w, f.screenY * h, w, h)
    camera.updateMatrixWorld()
    rig.updateMatrixWorld(true)
    interaction.update(camera, free && f.opacity > 0.5, w, h, currentSection.el)
    host.style.opacity = String(f.opacity)

    // Arriving at the spec sheet, the machine fades in already registered to the front elevation and
    // dolly-zooms into it; once there, the orthographic camera renders. Leaving, it stays registered
    // to the drawing while it fades, so it scrolls away with the drawing instead of drifting over the
    // next section, and the drawing's own outline fades back in as it goes (and stays, past the spec
    // sheet), so the dimension lines never frame an empty drawing. (Reduced motion: t is snapped, so
    // this is a cut.)
    const ids = [sections[a].id, sections[b].id]
    const leavingSpecs = ids[0] === 'specs' && ids[1] !== 'specs'
    const specsWeight = ids[0] === 'specs' && ids[1] === 'specs' ? 1 : ids[1] === 'specs' ? t : leavingSpecs ? 1 : 0
    const specsAt = sections.findIndex((s) => s.id === 'specs')
    setElevationBody(leavingSpecs || (specsAt >= 0 && a > specsAt) ? 1 - f.opacity : null)
    if (f.opacity <= 0.01) return
    if (specsWeight > 0 && registerOrtho()) {
      rig.rotation.y = 0
      rig.updateMatrixWorld(true)
      if (specsWeight >= 0.999) renderer.render(scene, ortho)
      else {
        dolly(specsWeight)
        renderer.render(scene, camera)
      }
    } else if (specsWeight > 0) {
      host.style.opacity = '0' // the drawing isn't laid out yet: nothing to register to
    } else {
      renderer.render(scene, camera)
    }
  }

  return { frame, resize }
}
