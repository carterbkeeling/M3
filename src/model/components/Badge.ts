import * as THREE from 'three'
import { accent } from '../config.ts'
import { roundedSlab } from '../shapes.ts'

// An access badge: a plain ID-1 card (54 × 86 mm) in bone with a thin cyan stripe. No text, no
// logo. A prop for the unlock scene (it taps the reader), not part of the machine: buildMachine()
// never makes one, so the GLB export and the free views don't carry it.
// Its origin is the middle of the card's back face; the face with the stripe looks along +z.

export const BADGE = { w: 0.054, h: 0.086, t: 0.0009, r: 0.0032 }

export interface BadgeParts {
  group: THREE.Group
  /** Fades the card in and out (0–1). */
  setOpacity(o: number): void
}

export function buildBadge(): BadgeParts {
  const group = new THREE.Group()
  group.name = 'Badge'
  // Always transparent, so fading never swaps the shader program mid-scroll.
  const card = new THREE.MeshStandardMaterial({ color: '#F3EFE7', roughness: 0.55, metalness: 0, transparent: true })
  // The stripe is printed on: offset in depth so it never fights the card face, even from far away.
  const stripe = new THREE.MeshStandardMaterial({
    color: accent.pipe,
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  })
  const body = new THREE.Mesh(roundedSlab(BADGE.w, BADGE.h, BADGE.t, BADGE.r, 0.0003), card)
  body.name = 'BadgeCard'
  const band = new THREE.Mesh(new THREE.PlaneGeometry(BADGE.w - 0.001, 0.006), stripe)
  band.name = 'BadgeStripe'
  band.position.set(0, BADGE.h / 2 - 0.017, BADGE.t + 0.0002)
  group.add(body, band)
  return {
    group,
    setOpacity(o) {
      card.opacity = stripe.opacity = o
    },
  }
}
