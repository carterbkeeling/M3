import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Machine } from '../model/buildMachine.ts'

// Lighting for a dark molded machine on both page tones (browser-side; needs a renderer for PMREM).
//
// One soft RoomEnvironment (through PMREM) does most of the work on the matte plastic; three
// directional lights shape it: a warm-neutral key from upper left, a soft fill from the right and
// a cool rim from behind that keeps the silhouette off a dark background. A hemisphere light adds
// a little sky/floor bounce. Section tone changes only intensities (and the floor treatment), so
// the machine's colors never shift between sections.

export type Tone = 'dark' | 'light'

interface TonePreset {
  env: number // scene.environmentIntensity
  key: number
  fill: number
  rim: number
  hemi: number
  hemiGround: THREE.Color
  shadow: number // contact shadow opacity
  glow: number // bone-tinted floor glow opacity (dark sections only)
}

// Tuned for Graphite #15161A and Bone #F3EFE7 backgrounds.
const PRESETS: Record<Tone, TonePreset> = {
  dark: { env: 0.95, key: 2.1, fill: 0.85, rim: 2.4, hemi: 0.45, hemiGround: new THREE.Color('#3A3833'), shadow: 0.85, glow: 0.11 },
  light: { env: 0.8, key: 2.1, fill: 0.75, rim: 1.0, hemi: 0.55, hemiGround: new THREE.Color('#D8D2C6'), shadow: 0.5, glow: 0 },
}

export interface Lighting {
  key: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  rim: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  environment: THREE.Texture
  /**
   * Blend the lighting toward a section tone. t = 1 (default) is fully that tone; 0 < t < 1 is
   * part way there from the other tone, for scroll-blended transitions at a section boundary.
   */
  setTone(tone: Tone, t?: number): void
  dispose(): void
}

export interface LightingOptions {
  /** Key light casts a shadow map (self-shadowing of doors and pulled modules). Default false. */
  shadows?: boolean
  /** Starting tone. Default 'dark'. */
  tone?: Tone
}

// Contact shadows created by createContactShadow(); setTone() updates them with the lights.
const contactShadows = new Set<ContactShadow>()
// The floor values of the current tone, for contact shadows created after the last setTone().
const floor = { shadow: PRESETS.dark.shadow, glow: PRESETS.dark.glow }

export function setupLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer, opts: LightingOptions = {}): Lighting {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04).texture
  room.dispose()
  pmrem.dispose()
  scene.environment = environment

  const key = new THREE.DirectionalLight('#FFF6EC', 2)
  key.name = 'KeyLight'
  key.position.set(-1.3, 3.4, 2.4)
  const fill = new THREE.DirectionalLight('#F2F4FA', 0.8)
  fill.name = 'FillLight'
  fill.position.set(2.8, 1.3, 1.6)
  const rim = new THREE.DirectionalLight('#CFE6FF', 2)
  rim.name = 'RimLight'
  rim.position.set(-2.2, 2.4, -2.6)
  const hemi = new THREE.HemisphereLight('#FFFFFF', '#3A3833', 0.5)
  hemi.name = 'Hemisphere'
  // Directional lights aim at their target (origin by default); aim at mid-height instead.
  for (const l of [key, fill, rim]) l.target.position.set(0, 0.9, 0)
  scene.add(key, key.target, fill, fill.target, rim, rim.target, hemi)

  if (opts.shadows) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    const cam = key.shadow.camera
    cam.left = -1.4
    cam.right = 1.4
    cam.top = 1.6
    cam.bottom = -1.6
    cam.near = 0.5
    cam.far = 8
    key.shadow.bias = -0.0003
    key.shadow.normalBias = 0.012
    key.shadow.radius = 3
  }

  const lerp = THREE.MathUtils.lerp
  const ground = new THREE.Color()

  function setTone(tone: Tone, t = 1) {
    const to = PRESETS[tone]
    const from = PRESETS[tone === 'dark' ? 'light' : 'dark']
    const k = THREE.MathUtils.clamp(t, 0, 1)
    scene.environmentIntensity = lerp(from.env, to.env, k)
    key.intensity = lerp(from.key, to.key, k)
    fill.intensity = lerp(from.fill, to.fill, k)
    rim.intensity = lerp(from.rim, to.rim, k)
    hemi.intensity = lerp(from.hemi, to.hemi, k)
    hemi.groundColor.copy(ground.copy(from.hemiGround).lerp(to.hemiGround, k))
    floor.shadow = lerp(from.shadow, to.shadow, k)
    floor.glow = lerp(from.glow, to.glow, k)
    for (const s of contactShadows) s.setFloor(floor.shadow, floor.glow)
  }
  setTone(opts.tone ?? 'dark')

  return {
    key,
    fill,
    rim,
    hemi,
    environment,
    setTone,
    dispose() {
      scene.remove(key, key.target, fill, fill.target, rim, rim.target, hemi)
      if (scene.environment === environment) scene.environment = null
      environment.dispose()
      key.shadow.map?.dispose()
    },
  }
}

// ---- Contact shadow ---------------------------------------------------------------------------

export interface ContactShadow extends THREE.Mesh {
  /** Shadow and floor-glow opacities (setTone drives this; exposed for tuning). */
  setFloor(shadow: number, glow: number): void
  dispose(): void
}

let falloff: THREE.DataTexture | null = null

// A soft radial falloff (alpha only, white RGB) shared by the shadow and the glow.
function falloffTexture(): THREE.DataTexture {
  if (falloff) return falloff
  const N = 128
  const data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.min(1, Math.hypot(((x + 0.5) / N - 0.5) * 2, ((y + 0.5) / N - 0.5) * 2))
      // Smooth, gaussian-like falloff that reaches exactly zero at the rim.
      const a = Math.pow(1 - d * d, 2.4)
      const o = (y * N + x) * 4
      data[o] = data[o + 1] = data[o + 2] = 255
      data[o + 3] = Math.round(a * 255)
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  tex.name = 'ContactFalloff'
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  falloff = tex
  return tex
}

export interface ContactShadowOptions {
  /**
   * Draw the floor glow on dark tones. Default true. Stills turn it off: the glow is wider than a
   * still's frame, so it would end in a straight edge at the image border (a faint lighter box on
   * the page). The contact shadow fades out well inside the frame and stays.
   */
  glow?: boolean
}

/**
 * A soft contact shadow under the machine's footprint, with a faint bone-tinted floor glow around
 * it that only shows on dark sections (so the dark machine never sinks into a dark page).
 * The caller adds it to machine.root; setupLighting().setTone() keeps it in step with the tone.
 */
export function createContactShadow(machine: Machine, opts: ContactShadowOptions = {}): ContactShadow {
  const withGlow = opts.glow ?? true
  const { W, D } = machine.dims
  const tex = falloffTexture()

  // Core shadow: tight under the footprint, darkest at the feet.
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', map: tex, transparent: true, depthWrite: false, opacity: 0.8 })
  shadowMat.toneMapped = false
  // map is white RGB with the falloff in alpha, so color (black) × map = black, alpha = falloff.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.32, D * 1.42), shadowMat) as unknown as ContactShadow
  mesh.name = 'ContactShadow'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.0015
  mesh.renderOrder = -1

  // Floor glow: wider and very faint, drawn first so the shadow sits on top of it.
  const glowMat = new THREE.MeshBasicMaterial({ color: '#F3EFE7', map: tex, transparent: true, depthWrite: false, opacity: 0 })
  glowMat.toneMapped = false
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 3.2, D * 2.6), glowMat)
  glow.name = 'FloorGlow'
  glow.position.z = -0.0005 // just under the shadow (in the plane's local frame, -z is down)
  glow.renderOrder = -2
  glow.visible = false
  mesh.add(glow)

  mesh.setFloor = (shadow: number, glowOpacity: number) => {
    shadowMat.opacity = shadow
    glowMat.opacity = withGlow ? glowOpacity : 0
    glow.visible = glowMat.opacity > 0.002
  }
  mesh.dispose = () => {
    contactShadows.delete(mesh)
    mesh.removeFromParent()
    mesh.geometry.dispose()
    glow.geometry.dispose()
    shadowMat.dispose()
    glowMat.dispose()
  }
  mesh.setFloor(floor.shadow, floor.glow)
  contactShadows.add(mesh)
  return mesh
}
