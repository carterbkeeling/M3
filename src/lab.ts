import '@fontsource/m-plus-rounded-1c/latin-900.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { config as baseConfig, colorways, type ColorwayId, type DoorStyle, type MachineConfig, type StrokePathKind } from './model/config.ts'
import { buildMachine } from './model/buildMachine.ts'
import { setDefaultMaterialTier, type MaterialTier } from './model/materials.ts'
import { applyPlacards } from './model/placardAtlas.ts'
import { setDoorOpen, setModulePulled, setModuleRemoved } from './model/machineState.ts'
import { createContactShadow, setupLighting } from './scene/lighting.ts'

// Dev-only lab harness: a bare scene with orbit controls, using the production materials, lighting
// and placard atlas. URL overrides sit on top of config.ts for captures only; approved choices get
// written back into config.ts.

declare global {
  interface Window {
    __labReady?: boolean
  }
}

const params = new URLSearchParams(location.search)
const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  const v = params.get(key) as T | null
  return v && allowed.includes(v) ? v : fallback
}

const cfg: MachineConfig = structuredClone(baseConfig)
cfg.colorway = pick<ColorwayId>('colorway', Object.keys(colorways) as ColorwayId[], cfg.colorway)
cfg.door.style = pick<DoorStyle>('door', ['side', 'drop'], cfg.door.style)
cfg.stroke.path = pick<StrokePathKind>('stroke', ['spine', 'serpentine'], cfg.stroke.path)
const grid = params.get('grid')?.match(/^(\d+)x(\d+)$/)
if (grid) cfg.grid = { cols: Number(grid[1]), rows: Number(grid[2]) }
const modulesMode = pick('modules', ['all', 'one', 'none', 'some'] as const, 'all')
const state = pick('state', ['closed', 'open', 'pulled', 'removed'] as const, 'closed')
const view = pick('view', ['front', 'threequarter', 'threequarterleft', 'side', 'back', 'ortho', 'detail', 'reader', 'placard', 'hero'] as const, 'threequarter')
const tier = pick<MaterialTier>('tier', ['high', 'standard'], 'high')
const showScale = params.get('scale') === '1'
const shadows = params.get('shadows') === '1'
const demoLights = params.get('lights') === 'demo'
const bg = pick('bg', ['dark', 'light'] as const, 'dark')
const focusSlot = Number(params.get('slot') ?? 4)
// Lab-only: rename one placard (?name=…&packed=…) to check long names and shrink-to-fit.
const rename = params.get('name')
if (rename) cfg.modules[focusSlot] = { product: rename, packed: params.get('packed') ?? cfg.modules[focusSlot]?.packed ?? '10' }
if (modulesMode === 'none') cfg.modules = []
// 'some': every third slot empty, to check the atlas with gaps.
if (modulesMode === 'some') cfg.modules = cfg.modules.map((m, i) => (i % 3 === 1 ? undefined : m)) as MachineConfig['modules']
document.body.classList.toggle('light', bg === 'light')
document.body.classList.toggle('clean', params.get('clean') === '1')

// When only one module is shown, put it in the focus slot.
if (modulesMode === 'one') {
  const spec = baseConfig.modules[0]
  cfg.modules = Array.from({ length: focusSlot + 1 }, (_, i) => (i === focusSlot ? spec : undefined)) as MachineConfig['modules']
}

setDefaultMaterialTier(tier)
const machine = buildMachine(cfg)
if (state === 'open') setDoorOpen(machine, focusSlot, 1)
if (state === 'pulled') {
  // A closed module slides out on its rails, door and all (on site, only closed modules move).
  setModulePulled(machine, focusSlot, 0.6)
}
if (state === 'removed') setModuleRemoved(machine, focusSlot, true)
if (demoLights) {
  // Mixed states in one frame: two slots empty (dim), one unlocked and open (bright), rest plugged in.
  setModuleRemoved(machine, 3, true)
  setModuleRemoved(machine, 8, true)
  setDoorOpen(machine, 6, 1)
}

// Scene
const BG = { dark: '#15161A', light: '#F3EFE7' }
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.NeutralToneMapping
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(BG[bg])
const lighting = setupLighting(scene, renderer, { shadows, tone: bg })

if (shadows) {
  machine.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: bg === 'dark' ? 0.3 : 0.14 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}
machine.root.add(createContactShadow(machine))
scene.add(machine.root)

// Lab-only scale reference: a plain 1.75 m figure beside the machine (never part of the model).
if (showScale) {
  const fig = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: bg === 'dark' ? '#5C5E63' : '#9A9893', roughness: 0.9 })
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.72, 6, 16), mat)
  legs.position.y = 0.075 + 0.36 + 0.02
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 6, 16), mat)
  torso.position.y = 0.95 + 0.21 + 0.05
  torso.scale.z = 0.6
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 16), mat)
  head.position.y = 1.75 - 0.105
  fig.add(legs, torso, head)
  fig.position.set(-(machine.dims.W / 2 + 0.42), 0, 0.1)
  scene.add(fig)
}

// Cameras
const { W, H, D } = machine.dims
const target = new THREE.Vector3(0, H / 2, 0)
const aspect = window.innerWidth / window.innerHeight
const persp = new THREE.PerspectiveCamera(26, aspect, 0.05, 50)
const spanW = showScale ? W + 1.0 : W
if (showScale) target.x = -0.42
const fit = (Math.max(H, spanW / aspect) * 1.18) / 2 / Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)) * (state === 'closed' ? 1 : 1.15)
const dir = {
  front: new THREE.Vector3(0, 0.02, 1),
  threequarter: new THREE.Vector3(0.62, 0.2, 1),
  threequarterleft: new THREE.Vector3(-0.6, 0.2, 1),
  side: new THREE.Vector3(1, 0.08, 0),
  back: new THREE.Vector3(-0.5, 0.15, -1),
  ortho: new THREE.Vector3(0, 0, 1),
  detail: new THREE.Vector3(0.75, 0.25, 1),
  reader: new THREE.Vector3(0.45, 0.2, 1),
  placard: new THREE.Vector3(0.3, 0.12, 1),
  hero: new THREE.Vector3(0.62, 0.16, 1),
}[view].normalize()
const focus = machine.layout.slots[Math.min(focusSlot, machine.layout.slots.length - 1)]
if (view === 'reader') {
  const rd = machine.strokePath.reader
  target.set(rd.x, rd.y, machine.layout.zFront)
  persp.position.copy(target).addScaledVector(dir, 0.75)
} else if (view === 'placard') {
  // Close on one door's placard (~0.6 m away): the nearest a visitor's camera gets.
  const placard = machine.slots[focus.index]?.module?.door.placard.insert
  if (placard) placard.getWorldPosition(target)
  else target.set(focus.x, focus.y, machine.layout.zFront)
  persp.position.copy(target).addScaledVector(dir, 0.62)
} else if (view === 'hero') {
  // About the hero framing: the machine ~700 px tall in a 900 px viewport.
  persp.position.copy(target).addScaledVector(dir, (H * 1.3) / 2 / Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)) + D / 2)
} else if (view === 'detail') {
  // Close on the focus slot at about 1.25 m. With the module pulled out, look past it from the
  // side and above so the open slot's fitment shows.
  if (state === 'pulled') {
    target.set(focus.x, focus.y - 0.03, machine.layout.zFront + 0.22)
    dir.set(-0.8, 0.45, 1).normalize()
    persp.position.copy(target).addScaledVector(dir, 1.6)
  } else {
    target.set(focus.x, focus.y, machine.layout.zFront - (state === 'removed' ? 0.15 : 0))
    if (state === 'removed') dir.set(0.35, 0.3, 1).normalize()
    persp.position.copy(target).addScaledVector(dir, 1.25)
  }
} else {
  persp.position.copy(target).addScaledVector(dir, fit + D / 2)
}

const half = (Math.max(H, spanW / aspect) * 1.14) / 2
const ortho = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.05, 50)
ortho.position.set(target.x, H / 2, 10)
ortho.lookAt(target)
const camera = view === 'ortho' ? ortho : persp

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.copy(target)
controls.enableDamping = true
controls.update()

const info = document.getElementById('info')!
info.textContent =
  `m³ lab · ${colorways[cfg.colorway].name} · ${tier} tier · door ${cfg.door.style} · stroke ${cfg.stroke.path} · grid ${cfg.grid.cols}×${cfg.grid.rows}\n` +
  `outer ${W.toFixed(3)} × ${H.toFixed(3)} × ${D.toFixed(3)} m  (${(W / 0.0254).toFixed(1)} × ${(H / 0.0254).toFixed(1)} × ${(D / 0.0254).toFixed(1)} in)`

window.addEventListener('resize', () => {
  const a = window.innerWidth / window.innerHeight
  persp.aspect = a
  persp.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Ready for a capture once the placards are drawn with the real fonts and a few frames are in.
let placardsReady = false
applyPlacards(machine, renderer)
  .then((atlas) => atlas.fontsReady)
  .catch((e: unknown) => console.error(e))
  .finally(() => (placardsReady = true))

let frames = 0
renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
  if (placardsReady && ++frames === 3) window.__labReady = true
})

// Expose for console tuning in the lab only.
Object.assign(window, { lab: { scene, machine, lighting, renderer } })
