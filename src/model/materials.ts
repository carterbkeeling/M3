import * as THREE from 'three'
import { accent, colorways, type ColorwayId } from './config.ts'

// Molded-plastic materials. DOM-free: everything here (including the grain texture) is built from
// typed arrays, so buildMachine() still runs in Node.
//
// The look is tough, inexpensive injection-molded plastic: a dark matte base with a fine molded
// grain, and only a thin satin layer on top, so the edge radii catch soft highlights while the flat
// faces stay matte. Nothing is metallic and nothing is glossy.
//
// Tiers:
//  'high'     MeshPhysicalMaterial: matte base + low satin clearcoat + a little sheen, molded grain.
//  'standard' MeshStandardMaterial: same colors, roughness and grain, no clearcoat or sheen
//             (for weaker GPUs).
//
// The grain is one shared noise normal map (a DataTexture). It is sampled triplanar in object
// space instead of through UVs, because the molded parts come from very different generators
// (swept skins with no UVs, extrusions in meters, boxes in 0–1), and a molded texture has to have
// the same scale on every part. It still sits in `normalMap`, so normalScale sets its strength.

export type MaterialTier = 'high' | 'standard'

export interface MachineMaterials {
  body: THREE.MeshStandardMaterial
  interior: THREE.MeshStandardMaterial
  door: THREE.MeshStandardMaterial
  fitment: THREE.MeshStandardMaterial
  connector: THREE.MeshStandardMaterial
  placardHolder: THREE.MeshStandardMaterial
  placardInsert: THREE.MeshStandardMaterial
  lock: THREE.MeshStandardMaterial
  feet: THREE.MeshStandardMaterial
  reader: THREE.MeshStandardMaterial
  readerRing: THREE.MeshStandardMaterial
  carton: THREE.MeshStandardMaterial
  pipeConnector: THREE.MeshStandardMaterial
  pipeSegment: () => THREE.MeshStandardMaterial // one per slot, so each light can change on its own
}

// Light-pipe states. Brightness comes from the emissive term only (the pipe's base color is near
// black and identical in every state), so the states read apart by brightness alone.
export const pipeIntensity = { none: 0.07, plugged: 0.75, unlocked: 1.6, connector: 0.4, reader: 0.9 }

// Grain: tiles per meter of the shared noise texture. 512 texels over 60 mm ≈ 0.12 mm per texel;
// the molded bumps are about 0.25–1 mm across, so the grain shows up close and averages out
// (through the mipmaps) into plain matte further away, like a real molded texture.
export const GRAIN_TILES_PER_M = 1 / 0.06
const GRAIN_SIZE = 512

let defaultTier: MaterialTier = 'high'

// buildMachine() calls createMaterials(colorway) without a tier, so callers that build the machine
// pick the tier here first (e.g. 'standard' on weak GPUs).
export function setDefaultMaterialTier(tier: MaterialTier) {
  defaultTier = tier
}

export function getDefaultMaterialTier(): MaterialTier {
  return defaultTier
}

export function createMaterials(id: ColorwayId, tier: MaterialTier = defaultTier): MachineMaterials {
  const c = colorways[id]
  const grain = getGrainTexture()
  const high = tier === 'high'

  // Molded plastic. `edge` is how much satin the edge radii pick up (clearcoat in the high tier).
  const plastic = (color: string, roughness: number, opts: { edge?: number; grain?: number; side?: THREE.Side } = {}) => {
    const { edge = 1, grain: grainStrength = 0.32, side = THREE.FrontSide } = opts
    const base: THREE.MeshStandardMaterialParameters = {
      color,
      roughness,
      metalness: 0,
      side,
      normalMap: grainStrength > 0 ? grain : null,
      normalScale: new THREE.Vector2(grainStrength, grainStrength),
    }
    const mat = high
      ? new THREE.MeshPhysicalMaterial({
          ...base,
          ior: 1.5,
          specularIntensity: 0.85,
          // A thin, soft satin layer: shows on the radii at grazing angles, barely on flat faces.
          clearcoat: satinCoat(roughness) * edge,
          clearcoatRoughness: satinCoatRoughness(roughness),
          // A touch of sheen lifts the silhouette of a dark part without making it shiny.
          sheen: 0.22 * edge,
          sheenRoughness: 0.6,
          sheenColor: new THREE.Color(color).lerp(new THREE.Color('#B9BDC6'), 0.35),
        })
      : new THREE.MeshStandardMaterial(base)
    if (grainStrength > 0) applyGrain(mat)
    return mat
  }

  // Brightness comes only from the emissive term, so the light states read apart.
  const pipe = (intensity: number) =>
    new THREE.MeshStandardMaterial({
      color: '#06090B',
      roughness: 0.35,
      metalness: 0,
      emissive: new THREE.Color(accent.pipe),
      emissiveIntensity: intensity,
    })

  return {
    body: plastic(c.body, c.bodyRoughness),
    // Doors are molded in a separate tool: a step lighter and slightly smoother than the body.
    door: plastic(c.door, c.doorRoughness),
    interior: plastic(c.interior, 0.9, { side: THREE.BackSide, edge: 0, grain: 0.22 }),
    fitment: plastic(c.fitment, 0.62, { edge: 0.6 }),
    connector: plastic('#6E727B', 0.5, { edge: 0.6, grain: 0.18 }),
    placardHolder: plastic(c.placardHolder, Math.max(0.3, c.doorRoughness - 0.1), { edge: 1.2 }),
    // The printed insert: a matte label. placardAtlas.ts gives it the atlas map (color goes white).
    placardInsert: new THREE.MeshStandardMaterial({ color: c.placardInsert, roughness: 0.86, metalness: 0 }),
    lock: plastic('#55585F', 0.55, { edge: 0.7, grain: 0.2 }),
    feet: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.95, metalness: 0 }), // rubber
    reader: plastic('#1C1D21', 0.45, { edge: 1.4, grain: 0.12 }), // smoother tap face
    readerRing: pipe(pipeIntensity.reader), // the light ring around the reader; pulses on a tap
    carton: new THREE.MeshStandardMaterial({ color: '#8A8378', roughness: 0.95, metalness: 0 }),
    pipeConnector: pipe(pipeIntensity.connector),
    pipeSegment: () => pipe(pipeIntensity.plugged),
  }
}

// Satin layer strength and roughness from the base roughness: matte parts get a faint, broad
// layer; the satin colorway's doors get a little more. Never enough to read as gloss.
function satinCoat(roughness: number) {
  return THREE.MathUtils.clamp(0.06 + 0.22 * (1 - roughness), 0.06, 0.2)
}
function satinCoatRoughness(roughness: number) {
  return THREE.MathUtils.clamp(0.22 + 0.3 * roughness, 0.3, 0.5)
}

// ---- Grain ------------------------------------------------------------------------------------

let grainTexture: THREE.DataTexture | null = null

// One shared tileable noise normal map for every molded part (built once, from a typed array).
export function getGrainTexture(): THREE.DataTexture {
  if (grainTexture) return grainTexture
  const data = grainNormalData(GRAIN_SIZE, 0x6d33)
  const tex = new THREE.DataTexture(data, GRAIN_SIZE, GRAIN_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType)
  tex.name = 'MoldedGrain'
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true // far away the grain averages out to a flat normal (no sparkle)
  tex.anisotropy = 4
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  grainTexture = tex
  return tex
}

// Tileable height field (periodic value noise, a few octaves of soft bumps plus a fine stipple),
// turned into a tangent-space normal map. Deterministic for a given seed.
export function grainNormalData(size: number, seed: number): Uint8Array {
  const rand = mulberry32(seed)
  const height = new Float32Array(size * size)
  const octaves: Array<[cells: number, amp: number]> = [
    [size / 8, 0.5], // 8-texel cells ≈ 0.9 mm
    [size / 4, 0.33], // ≈ 0.5 mm
    [size / 2, 0.17], // ≈ 0.25 mm stipple
  ]
  for (const [cells, amp] of octaves) {
    const n = Math.max(2, Math.round(cells))
    const lattice = new Float32Array(n * n)
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand() * 2 - 1
    const step = size / n
    for (let y = 0; y < size; y++) {
      const gy = y / step
      const y0 = Math.floor(gy)
      const ty = smooth(gy - y0)
      const r0 = (y0 % n) * n
      const r1 = ((y0 + 1) % n) * n
      for (let x = 0; x < size; x++) {
        const gx = x / step
        const x0 = Math.floor(gx)
        const tx = smooth(gx - x0)
        const c0 = x0 % n
        const c1 = (x0 + 1) % n
        const a = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * tx
        const b = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * tx
        height[y * size + x] += amp * (a + (b - a) * ty)
      }
    }
  }
  const out = new Uint8Array(size * size * 4)
  const k = 2.2 // slope gain: how steep the bumps are before normalScale
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k
      const dy = (at(x, y + 1) - at(x, y - 1)) * k
      const inv = 1 / Math.hypot(dx, dy, 1)
      const o = (y * size + x) * 4
      out[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      out[o + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255)
      out[o + 2] = Math.round((inv * 0.5 + 0.5) * 255)
      out[o + 3] = 255
    }
  }
  return out
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Triplanar grain: replaces the UV-based tangent-space normal map lookup with three object-space
// projections blended by the surface normal, so the grain has one scale on every part and moves
// with the part (doors, pulled modules). The shader source is identical for every material, so
// they share programs; strength comes from each material's normalScale.
const GRAIN_VERTEX_PARS = /* glsl */ `
varying vec3 vGrainPos;
varying vec3 vGrainNrm;
varying vec3 vGrainAX;
varying vec3 vGrainAY;
varying vec3 vGrainAZ;
`
const GRAIN_VERTEX = /* glsl */ `
#include <begin_vertex>
vGrainPos = transformed;
vGrainNrm = objectNormal;
vGrainAX = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );
vGrainAY = normalize( normalMatrix * vec3( 0.0, 1.0, 0.0 ) );
vGrainAZ = normalize( normalMatrix * vec3( 0.0, 0.0, 1.0 ) );
`
const GRAIN_FRAGMENT_PARS = /* glsl */ `
uniform float grainScale;
varying vec3 vGrainPos;
varying vec3 vGrainNrm;
varying vec3 vGrainAX;
varying vec3 vGrainAY;
varying vec3 vGrainAZ;
`
const GRAIN_FRAGMENT = /* glsl */ `
#ifdef USE_NORMALMAP_TANGENTSPACE
{
	vec3 gp = vGrainPos * grainScale;
	vec3 gw = pow( abs( normalize( vGrainNrm ) ), vec3( 4.0 ) );
	gw /= max( gw.x + gw.y + gw.z, 1e-5 );
	vec2 gx = texture2D( normalMap, gp.zy ).xy * 2.0 - 1.0;
	vec2 gy = texture2D( normalMap, gp.xz + vec2( 0.37, 0.61 ) ).xy * 2.0 - 1.0;
	vec2 gz = texture2D( normalMap, gp.xy + vec2( 0.73, 0.19 ) ).xy * 2.0 - 1.0;
	vec3 gpert = gw.x * vec3( 0.0, gx.y, gx.x ) + gw.y * vec3( gy.x, 0.0, gy.y ) + gw.z * vec3( gz.x, gz.y, 0.0 );
	normal = normalize( normal + ( vGrainAX * gpert.x + vGrainAY * gpert.y + vGrainAZ * gpert.z ) * normalScale.x );
}
#else
#include <normal_fragment_maps>
#endif
`

function applyGrain(mat: THREE.MeshStandardMaterial) {
  const grainScale = { value: GRAIN_TILES_PER_M }
  mat.userData.grainScale = grainScale
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.grainScale = grainScale
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GRAIN_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', GRAIN_VERTEX)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GRAIN_FRAGMENT_PARS}`)
      .replace('#include <normal_fragment_maps>', GRAIN_FRAGMENT)
  }
  // Same injected source for every grained material, so one cache key is correct.
  mat.customProgramCacheKey = () => 'm3-grain-1'
}
