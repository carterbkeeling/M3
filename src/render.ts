import '@fontsource/m-plus-rounded-1c/latin-500.css'
import '@fontsource/m-plus-rounded-1c/latin-900.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { config } from './model/config.ts'
import { viewBoxOf, wordmark } from './brand/wordmark.ts'
import { buildMachine } from './model/buildMachine.ts'
import { applyPlacards } from './model/placardAtlas.ts'
import { setContentsFill, setDoorOpen, setModulePulled } from './model/machineState.ts'
import { createContactShadow, setupLighting, type ContactShadowOptions } from './scene/lighting.ts'
import { explodedScene, unlockScene } from './scene/scenes.ts'

// Dev-only asset renderer. Exposes window.__m3render with:
//   still(name, width, height) → data URL (WebP, transparent) of a posed machine view
//   og() → data URL (PNG, 1200×630) for the share card
//   glb() → base64 of the binary glTF of the machine at rest
// The poses mirror the page's scenes so the no-WebGL stills match what WebGL visitors see.

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.toneMapping = THREE.NeutralToneMapping
renderer.setClearColor(0x000000, 0)
document.body.style.margin = '0'
document.body.append(renderer.domElement)

const scene = new THREE.Scene()
const lights = setupLighting(scene, renderer)
const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 60)

// Stills keep only the contact shadow: they sit on the page with transparent edges, and the floor
// glow is wider than their frame. The OG card is opaque, so its glow simply runs off the card.
function fresh(floor: ContactShadowOptions | null = { glow: false }) {
  for (const c of [...scene.children]) if (c.userData.machine) scene.remove(c)
  const machine = buildMachine(config)
  if (floor) machine.root.add(createContactShadow(machine, floor))
  const rig = new THREE.Group()
  rig.userData.machine = true
  rig.add(machine.root)
  scene.add(rig)
  return { machine, rig }
}

let current = fresh()
const ready = applyPlacards(current.machine, renderer)

function frameView(yaw: number, pitch: number, dist: number, lookY: number, w: number, h: number) {
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  current.rig.rotation.y = yaw
  camera.position.set(0, lookY + Math.sin(pitch) * dist, Math.cos(pitch) * dist)
  camera.lookAt(0, lookY, 0)
}

const cols = config.grid.cols
const midRow = Math.max(0, Math.round(config.grid.rows / 2) - 1)
const SWAP = Math.min(current.machine.slots.length - 1, midRow * cols + cols - 1)
const EXPLODE = Math.min(current.machine.slots.length - 1, cols * Math.max(0, midRow - 1))
const UNLOCK = Math.min(current.machine.slots.length - 1, (midRow + 1) * cols)

type Pose = (m: ReturnType<typeof fresh>) => void
const POSES: Record<string, { pose: Pose; view: [number, number, number, number]; tone: 'dark' | 'light' }> = {
  hero: { pose: () => {}, view: [-0.5, 0.1, 5.4, 0.95], tone: 'dark' },
  swap: { pose: ({ machine }) => setModulePulled(machine, SWAP, 0.55), view: [-0.4, 0.12, 5.4, 0.95], tone: 'dark' },
  // The page's scene with the module set aside, its empty slot's fitment lit and the body apart, seen
  // nearly face-on (as the page shows the lit slot) so the connector at the slot's back is in view.
  exploded: { pose: ({ machine }) => explodedScene(machine, EXPLODE).apply(0.7), view: [0.17, 0.12, 5.7, 0.92], tone: 'light' },
  // The scene's tap (badge on the reader, ring pulsing) with its outcome: the door open.
  unlock: {
    pose: ({ machine }) => {
      unlockScene(machine, UNLOCK).apply(0.2)
      setDoorOpen(machine, UNLOCK, 1)
    },
    view: [-0.14, 0.04, 5.2, 0.9],
    tone: 'dark',
  },
}

async function still(name: string, width: number, height: number): Promise<string> {
  await ready
  current = fresh()
  await applyPlacards(current.machine, renderer)
  if (name === 'module-full' || name === 'module-returned') {
    // A single module on its own (gallery card art): the cabinet is not on stage.
    const slot = 0
    const mod = current.machine.slots[slot].module!.group
    for (const o of current.machine.root.children) o.visible = o === mod
    if (name === 'module-returned') {
      setDoorOpen(current.machine, slot, 1)
      setContentsFill(current.machine, slot, 0.35)
    }
    // The module's origin is the door face at its slot center; the tub runs ~0.78 m back from there.
    // Center the whole module on the stage.
    mod.position.set(0, 0.3, 0.36)
    lights.setTone('light')
    if (name === 'module-returned') frameView(-0.42, 0.3, 2.75, 0.3, width, height)
    else frameView(-0.5, 0.3, 2.35, 0.3, width, height)
  } else {
    const p = POSES[name]
    p.pose(current)
    lights.setTone(p.tone)
    frameView(...p.view, width, height)
  }
  renderer.render(scene, camera)
  return renderer.domElement.toDataURL('image/webp', 0.9)
}

async function og(): Promise<string> {
  // 1200×630 share card: graphite field, the m³ mark and its caption on the left, the machine at a
  // three-quarter view on the right.
  await ready
  current = fresh({ glow: true })
  await applyPlacards(current.machine, renderer)
  lights.setTone('dark')
  frameView(-0.5, 0.1, 5.2, 0.95, 1200, 630)
  camera.setViewOffset(1200, 630, -0.22 * 1200, 0, 1200, 630)
  renderer.render(scene, camera)
  camera.clearViewOffset()

  const card = document.createElement('canvas')
  card.width = 1200
  card.height = 630
  const ctx = card.getContext('2d')!
  ctx.fillStyle = '#15161A'
  ctx.fillRect(0, 0, 1200, 630)
  ctx.drawImage(renderer.domElement, 0, 0)
  // The approved mark (stroke centerlines) in bone.
  const [, , vw, vh] = viewBoxOf(wordmark)
  const markH = 150
  const k = markH / vh
  ctx.save()
  ctx.translate(80, 200)
  ctx.scale(k, k)
  ctx.strokeStyle = '#F3EFE7'
  ctx.lineWidth = wordmark.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of wordmark.paths) ctx.stroke(new Path2D(d))
  ctx.restore()
  await document.fonts.load('500 22px "JetBrains Mono Variable"')
  ctx.fillStyle = '#7F8187'
  ctx.font = '500 22px "JetBrains Mono Variable", ui-monospace, monospace'
  ctx.fillText('M-CUBED · MODULAR MACHINE MANAGEMENT', 82, 200 + markH + 56)
  void vw
  return card.toDataURL('image/png')
}

async function glb(): Promise<string> {
  await ready
  current = fresh(null)
  await applyPlacards(current.machine, renderer)
  // The molded grain is a generated DataTexture sampled triplanar in a shader patch, which glTF can't
  // carry (and GLTFExporter can't read): export those materials without it. Colors, roughness,
  // clearcoat, sheen and the placard atlas all survive.
  const stripped = new Map<THREE.Material, THREE.Material>() // one export material per source, so meshes still dedupe
  const strip = (mat: THREE.Material) => {
    const s = mat as THREE.MeshStandardMaterial
    if (!(s.normalMap instanceof THREE.DataTexture) && !(s.map instanceof THREE.DataTexture)) return mat
    let c = stripped.get(mat) as THREE.MeshStandardMaterial | undefined
    if (!c) {
      c = s.clone()
      if (c.normalMap instanceof THREE.DataTexture) c.normalMap = null
      if (c.map instanceof THREE.DataTexture) c.map = null
      stripped.set(mat, c)
    }
    return c
  }
  current.machine.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(strip) : strip(mesh.material)
  })
  const exporter = new GLTFExporter()
  const out = (await exporter.parseAsync(current.machine.root, { binary: true, onlyVisible: true, maxTextureSize: 2048 })) as ArrayBuffer
  let bin = ''
  const bytes = new Uint8Array(out)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

declare global {
  interface Window {
    __m3render?: { still: typeof still; og: typeof og; glb: typeof glb; ready: Promise<void> }
  }
}
window.__m3render = { still, og, glb, ready: ready.then(() => undefined) }
