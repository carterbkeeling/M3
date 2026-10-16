import type * as THREE from 'three'

// Every module is identical (one universal size), so their parts can share geometry: one tub, one
// door, one placard holder, built once and reused by all twelve. Keys must include every input
// that shapes the geometry, so different configs never collide. Never mutate a cached geometry.
const cache = new Map<string, THREE.BufferGeometry>()

export function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = cache.get(key) as T | undefined
  if (!g) {
    g = make()
    cache.set(key, g)
  }
  return g
}

export const keyOf = (name: string, ...nums: number[]) => `${name}:${nums.map((n) => n.toFixed(5)).join(',')}`
