import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { config as baseConfig, colorways, type ColorwayId, type DoorStyle, type MachineConfig, type StrokePathKind } from './model/config.ts'
import { buildMachine } from './model/buildMachine.ts'
import { setDoorOpen, setModulePulled, setModuleRemoved } from './model/machineState.ts'

// Dev-only blockout harness: a bare scene with orbit controls. URL overrides sit on top of
// config.ts for captures only; approved choices get written back into config.ts.

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
const modulesMode = pick('modules', ['all', 'one', 'none'] as const, 'all')
const state = pick('state', ['closed', 'open', 'pulled', 'removed'] as const, 'closed')
const view = pick('view', ['front', 'threequarter', 'threequarterleft', 'side', 'back', 'ortho', 'detail'] as const, 'threequarter')
const showScale = params.get('scale') === '1'
const demoLights = params.get('lights') === 'demo'
const bg = pick('bg', ['dark', 'light'] as const, 'dark')
const focusSlot = Number(params.get('slot') ?? 4)
if (modulesMode === 'none') cfg.modules = []
if (modulesMode === 'one') cfg.modules = cfg.modules.slice(0, 1)
document.body.classList.toggle('light', bg === 'light')
document.body.classList.toggle('clean', params.get('clean') === '1')

// When only one module is shown, put it in the focus slot.
if (modulesMode === 'one') {
  const spec = baseConfig.modules[0]
  cfg.modules = Array.from({ length: focusSlot + 1 }, (_, i) => (i === focusSlot ? spec : undefined)) as MachineConfig['modules']
}

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
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(BG[bg])
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.8

machine.root.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) {
    o.castShadow = true
    o.receiveShadow = true
  }
})
scene.add(machine.root)

const key = new THREE.DirectionalLight('#ffffff', 2.0)
key.position.set(-1.2, 3.6, 2.2)
key.castShadow = true
key.shadow.mapSize.set(2048, 2048)
key.shadow.camera.left = -3
key.shadow.camera.right = 3
key.shadow.camera.top = 4
key.shadow.camera.bottom = -1
key.shadow.bias = -0.0004
scene.add(key)
const fill = new THREE.DirectionalLight('#ffffff', 0.9)
fill.position.set(2.6, 1.4, 1.2)
scene.add(fill)
const rim = new THREE.DirectionalLight('#ffffff', bg === 'dark' ? 1.2 : 0.7)
rim.position.set(-2.4, 2.2, -2.0)
scene.add(rim)
scene.add(new THREE.HemisphereLight('#ffffff', bg === 'dark' ? '#2a2c31' : '#d8d2c6', 0.6))

const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: bg === 'dark' ? 0.25 : 0.16 }))
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Soft contact shadow under the footprint (a radial falloff baked into a small DataTexture).
const N = 64
const blob = new Uint8Array(N * N * 4)
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const dx = (x + 0.5) / N - 0.5
    const dy = (y + 0.5) / N - 0.5
    const d = Math.min(1, Math.hypot(dx * 2, dy * 2))
    const a = Math.pow(1 - d, 2.2)
    blob.set([0, 0, 0, Math.round(a * 255)], (y * N + x) * 4)
  }
}
const blobTex = new THREE.DataTexture(blob, N, N)
blobTex.needsUpdate = true
const contact = new THREE.Mesh(
  new THREE.PlaneGeometry(machine.dims.W * 1.5, machine.dims.D * 1.6),
  new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: bg === 'dark' ? 0.9 : 0.5, depthWrite: false }),
)
contact.rotation.x = -Math.PI / 2
contact.position.y = 0.001
scene.add(contact)

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
}[view].normalize()
if (view === 'detail') {
  // Close on the focus slot at about 1.25 m. With the module pulled out, look past it from the
  // side and above so the open slot's fitment shows.
  const s = machine.layout.slots[Math.min(focusSlot, machine.layout.slots.length - 1)]
  if (state === 'pulled') {
    target.set(s.x, s.y - 0.03, machine.layout.zFront + 0.22)
    dir.set(-0.8, 0.45, 1).normalize()
    persp.position.copy(target).addScaledVector(dir, 1.6)
  } else {
    target.set(s.x, s.y, machine.layout.zFront - (state === 'removed' ? 0.15 : 0))
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
  `m³ blockout · ${colorways[cfg.colorway].name} · door ${cfg.door.style} · stroke ${cfg.stroke.path} · grid ${cfg.grid.cols}×${cfg.grid.rows}\n` +
  `outer ${W.toFixed(3)} × ${H.toFixed(3)} × ${D.toFixed(3)} m  (${(W / 0.0254).toFixed(1)} × ${(H / 0.0254).toFixed(1)} × ${(D / 0.0254).toFixed(1)} in)`

window.addEventListener('resize', () => {
  const a = window.innerWidth / window.innerHeight
  persp.aspect = a
  persp.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

let frames = 0
renderer.setAnimationLoop(() => {
  controls.update()
  renderer.render(scene, camera)
  if (++frames === 3) window.__labReady = true
})
