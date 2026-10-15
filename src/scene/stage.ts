import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { config } from '../model/config.ts'
import { buildMachine } from '../model/buildMachine.ts'
import { boundaryBlend, getSections, stickyProgress } from '../ui/scrollMap.ts'
import { ELEVATION_PAD } from '../ui/elevation.ts'
import { framingFor, mixFraming, type Framing } from './framings.ts'
import { explodedScene, swapScene, unlockScene, type Scene } from './scenes.ts'

// The 3D stage: one renderer, one fixed canvas behind the content, one machine. The camera has a
// single owner (this file); scroll position picks the framing, scenes pose the machine, and the
// cursor adds a small clamped tilt in the hero.

export interface Stage {
  frame(scrollY: number, time: number): void
  resize(): void
}

export function startStage(host: HTMLElement, opts: { reducedMotion: boolean }): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.setClearColor(0x000000, 0)
  // Production skips shader info-log reads: faster startup, and the GPU driver's benign compiler
  // notes (e.g. D3D X4122 on this laptop) don't reach the console.
  renderer.debug.checkShaderErrors = import.meta.env.DEV
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.8
  pmrem.dispose()

  const key = new THREE.DirectionalLight('#ffffff', 2.0)
  key.position.set(-1.2, 3.6, 2.2)
  const fill = new THREE.DirectionalLight('#ffffff', 0.9)
  fill.position.set(2.6, 1.4, 1.2)
  const rim = new THREE.DirectionalLight('#ffffff', 1.2)
  rim.position.set(-2.4, 2.2, -2.0)
  scene.add(key, fill, rim, new THREE.HemisphereLight('#ffffff', '#2a2c31', 0.6))

  const machine = buildMachine(config)
  const rig = new THREE.Group()
  rig.add(machine.root)
  scene.add(rig)

  // Soft contact shadow under the footprint.
  const N = 64
  const blob = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.min(1, Math.hypot(((x + 0.5) / N - 0.5) * 2, ((y + 0.5) / N - 0.5) * 2))
      blob.set([0, 0, 0, Math.round(Math.pow(1 - d, 2.2) * 255)], (y * N + x) * 4)
    }
  }
  const blobTex = new THREE.DataTexture(blob, N, N)
  blobTex.needsUpdate = true
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(machine.dims.W * 1.5, machine.dims.D * 1.6),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.7, depthWrite: false }),
  )
  contact.rotation.x = -Math.PI / 2
  contact.position.y = 0.001
  machine.root.add(contact) // part of the machine, so it leaves the stage with it (warehouse beats)

  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 60)
  // Spec sheet: an orthographic front view registered to the elevation drawing's outline.
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 60)
  const elevation = document.querySelector<SVGSVGElement>('.elevation')
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

  // Cursor tilt (hero only), smoothed.
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  })

  let w = 1
  let h = 1
  let isMobile = false
  function resize() {
    w = window.innerWidth
    h = window.innerHeight
    isMobile = w < 900
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  function frame(scrollY: number, time: number) {
    const sections = getSections()
    if (!sections.length) return
    const [a, b, t] = boundaryBlend(scrollY, h)
    let f: Framing = mixFraming(framingFor(sections[a].id, isMobile), framingFor(sections[b].id, isMobile), t)

    let extraDist = 0
    let extraLook = 0
    for (const { el, scene } of scenes) {
      const p = stickyProgress(el, scrollY, h)
      scene.apply(p)
      const c = scene.camera?.(p)
      if (c && p > 0 && p < 1) {
        extraDist += c[0]
        extraLook += c[1]
      }
    }

    // Hero: slow idle drift plus a gentle tilt toward the cursor (fades out as the hero leaves).
    const heroWeight = a === 0 ? 1 - t : 0
    pointer.sx += (pointer.x - pointer.sx) * 0.07
    pointer.sy += (pointer.y - pointer.sy) * 0.07
    const drift = opts.reducedMotion ? 0 : Math.sin(time * 0.00025) * 0.06
    const yaw = f.yaw + heroWeight * (drift + (opts.reducedMotion ? 0 : pointer.sx * 0.1))
    const pitch = f.pitch + heroWeight * (opts.reducedMotion ? 0 : -pointer.sy * 0.05)

    f = { ...f, dist: f.dist + extraDist, lookY: f.lookY + extraLook }
    rig.rotation.y = yaw
    camera.position.set(0, f.lookY + Math.sin(pitch) * f.dist, Math.cos(pitch) * f.dist)
    camera.lookAt(0, f.lookY, 0)
    camera.setViewOffset(w, h, -f.screenX * w, f.screenY * h, w, h)
    host.style.opacity = String(f.opacity)
    if (f.opacity <= 0.01) return

    // Once the spec sheet is the main section on screen, cut to the registered front elevation.
    // (Phase 3 replaces the cut with a dolly-zoom handoff.)
    // Leaving the spec sheet, the machine stays registered to the drawing while it fades, so it
    // scrolls away with the drawing instead of drifting over the next section.
    const ids = [sections[a].id, sections[b].id]
    const leavingSpecs = ids[0] === 'specs' && ids[1] !== 'specs'
    const specsWeight = ids[0] === 'specs' && ids[1] === 'specs' ? 1 : ids[1] === 'specs' ? t : leavingSpecs ? 1 : 0
    if (specsWeight > 0.5 && registerOrtho()) {
      rig.rotation.y = 0
      renderer.render(scene, ortho)
    } else if (ids[1] === 'specs') {
      host.style.opacity = '0' // arriving at the spec sheet: appear only once registered to the drawing
    } else {
      renderer.render(scene, camera)
    }
  }

  return { frame, resize }
}
