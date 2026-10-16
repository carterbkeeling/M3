import * as THREE from 'three'
import { gsap } from 'gsap'
import type { Machine } from '../model/buildMachine.ts'
import { accent } from '../model/config.ts'
import { pipeIntensity } from '../model/materials.ts'
import { setDoorOpen, setModulePulled } from '../model/machineState.ts'
import { setLightState } from '../model/components/StatusLight.ts'
import { t } from '../content/copy.ts'

// Free interaction with the machine (hero and the parked views): drag to turn it within limits,
// hover a door to frame it, click to step its door cycle (tap → unlock and open → pull the module
// out → put it back and close). One door stands open at a time, and while it does the machine turns
// to face the visitor (present()). Keyboard parity: one DOM hotspot button projected over each door
// (roving arrow keys, Enter/Space to step, Esc to reset), two rotate buttons (and Shift+←/→), and an
// aria-live region that says each change of state in words. The camera stays owned by the stage:
// this only adds a clamped yaw offset, the present weight and per-slot door state on top of the
// scenes, and tells the stage while it still has something moving (busy()).

const MAX_YAW = (35 * Math.PI) / 180
const PULL = 0.62 // how far the door cycle pulls a module out (of its full travel)
const REPEAT_MS = 400 // the same door stepped again this soon (a double-click) counts once
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const
type Step = 0 | 1 | 2 // closed, open, pulled

interface SlotState {
  door: number
  pull: number
  step: Step
}

export interface Interaction {
  yawOffset(): number
  /** How far the machine is into presenting an open door (0 → 1): the stage eases the framing by it
   *  (framings.ts presentFraming). */
  present(): number
  update(camera: THREE.Camera, active: boolean, w: number, h: number, host?: HTMLElement): void
  reset(): void
  /** True while a door, module, turn, reader pulse or hover frame is still moving, or a change is
   *  waiting for its first frame: the stage keeps drawing until this settles. */
  busy(): boolean
}

export function createInteraction(machine: Machine, opts: { reducedMotion: boolean }): Interaction {
  const dur = (s: number) => (opts.reducedMotion ? Math.min(0.2, s) : s)
  const slots = machine.slots.filter((s) => s.module)
  const states = new Map<number, SlotState>()
  const L = machine.layout
  const ringMat = machine.materials.readerRing

  // Invisible hit boxes in front of each door (raycast targets that move with the machine).
  const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  const hits: THREE.Mesh[] = slots.map((s) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.rect.w, s.rect.h, 0.05), hitMat)
    m.position.set(s.rect.x, s.rect.y, L.zFront + 0.02)
    m.userData.slot = s.rect.index
    m.name = `Hit ${s.rect.index}`
    machine.root.add(m)
    return m
  })

  // Hover / focus frame: one constant-radius outline in the accent color, moved to the active door.
  const frameShape = new THREE.Shape()
  {
    const w = slots[0]?.rect.w ?? 0.4
    const h = slots[0]?.rect.h ?? 0.24
    const r = 0.012
    const x0 = -w / 2 - 0.006
    const y0 = -h / 2 - 0.006
    const x1 = w / 2 + 0.006
    const y1 = h / 2 + 0.006
    frameShape.moveTo(x0 + r, y0)
    frameShape.lineTo(x1 - r, y0)
    frameShape.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false)
    frameShape.lineTo(x1, y1 - r)
    frameShape.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false)
    frameShape.lineTo(x0 + r, y1)
    frameShape.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false)
    frameShape.lineTo(x0, y0 + r)
    frameShape.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false)
  }
  const framePts = frameShape.getSpacedPoints(160).map((p) => new THREE.Vector3(p.x, p.y, 0))
  const frame = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(framePts, true), 200, 0.0025, 8, true),
    new THREE.MeshBasicMaterial({ color: accent.pipe, transparent: true, opacity: 0 }),
  )
  frame.name = 'DoorFrame'
  machine.root.add(frame)

  // DOM: hotspots (keyboard), rotate buttons, hint, live region.
  const layer = document.createElement('div')
  layer.className = 'hotspots'
  layer.setAttribute('role', 'group')
  layer.setAttribute('aria-label', t('controls.region'))
  layer.hidden = true
  const live = document.createElement('div')
  live.className = 'sr-only'
  live.setAttribute('aria-live', 'polite')
  const buttons = slots.map((s, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'hotspot'
    b.tabIndex = i === 0 ? 0 : -1
    b.dataset.slot = String(s.rect.index)
    b.style.margin = '0' // update() sizes and places it over the whole door
    layer.append(b)
    return b
  })
  const controls = document.createElement('div')
  controls.className = 'turn'
  const mkTurn = (dir: -1 | 1) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `turn__btn turn__btn--${dir < 0 ? 'left' : 'right'}`
    b.setAttribute('aria-label', t(dir < 0 ? 'controls.rotateLeft' : 'controls.rotateRight'))
    b.addEventListener('click', () => turn(dir))
    return b
  }
  const hint = document.createElement('span')
  hint.className = 'turn__hint caption'
  hint.textContent = t('controls.hint')
  controls.append(mkTurn(-1), hint, mkTurn(1))
  layer.append(controls)
  // The live region stays put in main (a moved live region can drop announcements). The control layer
  // moves into whichever section shows the free view, so it sits inside that section's landmark and
  // right after its content in the tab order. It is position: fixed, so where it sits in the DOM
  // doesn't move it on screen.
  const main = document.querySelector('main') ?? document.body
  main.append(live)
  ;(document.getElementById('top') ?? main).append(layer)

  let yaw = 0
  const yawTween = { v: 0 }
  const present = { v: 0 }
  let presentGoal = 0
  function turn(dir: -1 | 1) {
    gsap.to(yawTween, { v: Math.max(-MAX_YAW, Math.min(MAX_YAW, yawTween.v + dir * 0.22)), duration: dur(0.45), ease: 'power3.out', overwrite: true })
  }

  const productOf = (slot: number) => machine.slots[slot].module?.spec.product ?? ''
  const stateWord = (slot: number) => {
    const st = states.get(slot)
    if (!machine.slots[slot].module) return t('light.none')
    return st && st.step > 0 ? t('light.unlocked') : t('light.plugged')
  }
  const actionOf = (slot: number) => {
    const step = states.get(slot)?.step ?? 0
    return t(step === 0 ? 'hotspot.action.unlock' : step === 1 ? 'hotspot.action.pull' : 'hotspot.action.close')
  }
  function labelButtons() {
    buttons.forEach((b, i) => {
      const slot = Number(b.dataset.slot)
      b.setAttribute('aria-label', `${t('hotspot.label', { product: productOf(slot), n: i + 1, state: stateWord(slot) })}. ${actionOf(slot)}`)
    })
  }
  labelButtons()

  // Door cycle for one slot. Stepping a door closes whichever other door stands open.
  let lastStep = { slot: -1, at: 0 }
  function step(slot: number) {
    const now = performance.now()
    if (slot === lastStep.slot && now - lastStep.at < REPEAT_MS) return
    lastStep = { slot, at: now }
    for (const [other, o] of states) if (other !== slot && o.step > 0) close(o)
    const st = states.get(slot) ?? { door: 0, pull: 0, step: 0 as Step }
    states.set(slot, st)
    gsap.killTweensOf(st)
    const product = productOf(slot)
    if (st.step === 0) {
      st.step = 1
      // tap at the reader: the ring pulses, then the door opens (a module caught mid-return goes home)
      gsap.fromTo(ringMat, { emissiveIntensity: pipeIntensity.reader + 1.4 }, { emissiveIntensity: pipeIntensity.reader, duration: dur(0.6), ease: 'power2.out' })
      gsap.to(st, { door: 1, pull: 0, duration: dur(0.7), delay: opts.reducedMotion ? 0 : 0.15, ease: 'power3.inOut' })
      // and the visitor's own turn eases out, so the machine ends facing them (see update())
      gsap.to(yawTween, { v: 0, duration: dur(0.8), ease: 'power2.inOut', overwrite: true })
      live.textContent = t('announce.unlocked', { product })
    } else if (st.step === 1) {
      st.step = 2
      // A door still opening (stepped again quickly) finishes first; then the module slides out.
      gsap.timeline()
        .to(st, { door: 1, duration: dur(0.35 * (1 - st.door)), ease: 'power2.out' })
        .to(st, { pull: PULL, duration: dur(0.6), ease: 'power3.inOut' })
      live.textContent = t('announce.pulled', { product })
    } else {
      close(st)
      live.textContent = t('announce.closed', { product })
    }
    labelButtons()
  }

  // Put the module back, then close the door (each leg as long as what is left of it).
  function close(st: SlotState) {
    gsap.killTweensOf(st)
    st.step = 0
    gsap.timeline()
      .to(st, { pull: 0, duration: dur(0.5 * Math.min(1, st.pull / PULL)), ease: 'power3.inOut' })
      .to(st, { door: 0, duration: dur(0.5 * st.door), ease: 'power3.inOut' })
  }

  function reset() {
    const wasOpen = [...states.values()].some((st) => st.step > 0)
    for (const st of states.values()) {
      gsap.killTweensOf(st)
      st.step = 0
      gsap.to(st, { door: 0, pull: 0, duration: dur(0.4), ease: 'power3.inOut' })
    }
    gsap.to(yawTween, { v: 0, duration: dur(0.5), ease: 'power3.inOut' })
    hover = -1
    labelButtons()
    if (wasOpen) live.textContent = t('announce.reset')
  }

  // Pointer: drag turns, click steps the door under the pointer, hover frames it.
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let hover = -1
  let focusSlot = -1
  let lastCamera: THREE.Camera | null = null
  let active = false
  let drag: { x: number; v0: number; moved: boolean } | null = null
  let pointerPx: { x: number; y: number } | null = null
  let pending = true // a change (focus, the pointer leaving) that the next frame has to show
  const ignore = (el: EventTarget | null) => el instanceof Element && !!el.closest('a, button, input, select, textarea, .copy, .nav, .cards, .spec, .hotspots, [data-noturn]')

  function pick(x: number, y: number): number {
    if (!lastCamera) return -1
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, lastCamera)
    const hit = raycaster.intersectObjects(hits, false)[0]
    return hit ? (hit.object.userData.slot as number) : -1
  }

  window.addEventListener('pointerdown', (e) => {
    if (!active || ignore(e.target) || e.button !== 0) return
    drag = { x: e.clientX, v0: yawTween.v, moved: false }
  })
  // Only a mouse (or a pen) hovers: a finger's last position is not a hover, and neither is a mouse
  // that has left the window.
  function clearHover() {
    pointerPx = null
    pending = true
  }
  window.addEventListener('pointermove', (e) => {
    pointerPx = e.pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY }
    if (!drag || !active) return
    const dx = e.clientX - drag.x
    if (Math.abs(dx) > 5) drag.moved = true
    if (drag.moved) {
      gsap.killTweensOf(yawTween)
      yawTween.v = Math.max(-MAX_YAW, Math.min(MAX_YAW, drag.v0 + dx * 0.006))
    }
  })
  window.addEventListener('pointerup', (e) => {
    const d = drag
    drag = null
    if (e.pointerType !== 'mouse') clearHover()
    if (!d || !active || d.moved) return
    const slot = pick(e.clientX, e.clientY)
    if (slot >= 0) step(slot)
  })
  window.addEventListener('pointercancel', (e) => {
    drag = null
    if (e.pointerType !== 'mouse') clearHover()
  })
  window.addEventListener('pointerout', (e) => {
    if (!e.relatedTarget) clearHover()
  })

  // Keyboard: roving focus across doors in grid order; Enter/Space step; Esc resets.
  const cols = machine.slots.length ? Math.max(...machine.layout.slots.map((s) => s.col)) + 1 : 1
  layer.addEventListener('keydown', (e) => {
    const b = e.target as HTMLElement
    const i = buttons.indexOf(b as HTMLButtonElement)
    // Holding Enter on a door repeats clicks: one step per press.
    if (i >= 0 && e.key === 'Enter' && e.repeat) {
      e.preventDefault()
      return
    }
    if (e.key === 'Escape') {
      reset()
      return
    }
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      turn(e.key === 'ArrowLeft' ? -1 : 1)
      return
    }
    if (i < 0) return
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
    if (move !== undefined) {
      e.preventDefault()
      const next = Math.max(0, Math.min(buttons.length - 1, i + move))
      buttons.forEach((x, k) => (x.tabIndex = k === next ? 0 : -1))
      buttons[next].focus()
    }
  })
  // Focus frames the door as hover does. Its accessible name already says the product and state, so
  // focus announces nothing more: the live region is for changes of state.
  buttons.forEach((b) => {
    b.addEventListener('click', () => step(Number(b.dataset.slot)))
    b.addEventListener('focus', () => {
      focusSlot = Number(b.dataset.slot)
      pending = true
    })
    b.addEventListener('blur', () => {
      focusSlot = -1
      pending = true
    })
  })

  const v = new THREE.Vector3()
  const frameOpacity = { v: 0 }
  let settling = false // the hover frame is still fading
  let shownSlot = -1
  const placed: string[] = [] // last box written per hotspot
  let pillH = 52
  // The machine's bottom silhouette (the body's corners at its underside, the feet's outer edges on
  // the floor): the turn controls go just under its lowest point on screen.
  const base: THREE.Vector3[] = []
  for (const sx of [-1, 1]) for (const z of [L.zBack, L.D / 2]) base.push(new THREE.Vector3((sx * L.W) / 2, L.skinBottom, z))
  for (const foot of machine.cabinet.group.getObjectByName('Feet')?.children ?? []) {
    const r = ((foot as THREE.Mesh).geometry as THREE.CylinderGeometry).parameters?.radiusBottom ?? 0
    base.push(new THREE.Vector3(foot.position.x + Math.sign(foot.position.x) * r, 0, foot.position.z + Math.sign(foot.position.z) * r))
  }

  const moving = (o: object) => gsap.getTweensOf(o).length > 0
  function busy() {
    if (pending || settling || moving(yawTween) || moving(present) || moving(ringMat)) return true
    for (const st of states.values()) if (moving(st)) return true
    return false
  }

  // Nothing stays hovered or framed, so coming back to a view starts clean.
  function clearFrame() {
    hover = -1
    shownSlot = -1
    settling = false
    frameOpacity.v = 0
    frame.material.opacity = 0
    frame.visible = false
    document.documentElement.style.removeProperty('cursor')
  }

  function update(camera: THREE.Camera, isActive: boolean, w: number, h: number, host?: HTMLElement) {
    lastCamera = camera
    pending = false
    // A jump straight from one free view to the other counts as leaving one and entering the next.
    const jumped = isActive && active && !!host && layer.parentElement !== host
    if (isActive !== active || jumped) {
      if (active) {
        if (layer.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
        reset()
        clearFrame()
      }
      // The view cut, so the doors and the turn cut too (no closing or turning back in the new view).
      if (jumped) {
        for (const st of states.values()) Object.assign(st, { door: 0, pull: 0 })
        gsap.killTweensOf([...states.values(), yawTween, present])
        yawTween.v = present.v = presentGoal = 0
      }
      active = isActive
      if (active && host && layer.parentElement !== host) host.append(layer)
      layer.hidden = !active
      if (active) pillH = controls.offsetHeight || pillH
    }
    yaw = yawTween.v

    // Apply per-slot door state over whatever the scenes set this frame.
    let open = false
    for (const [slot, st] of states) {
      if (st.door <= 0.0001 && st.pull <= 0.0001 && st.step === 0) {
        states.delete(slot)
        setDoorOpen(machine, slot, 0)
        setModulePulled(machine, slot, 0)
        setLightState(machine.slots[slot].light, 'plugged')
        continue
      }
      setDoorOpen(machine, slot, st.door)
      setModulePulled(machine, slot, st.pull)
      setLightState(machine.slots[slot].light, st.door > 0.01 ? 'unlocked' : 'plugged')
      if (st.step > 0 || st.pull > 0.0001) open = true
    }
    // Present: the machine turns to face the visitor as a door opens, holds while one stands open,
    // and turns back once the module is home (alongside the door closing, so the module never sweeps
    // across the wordmark on its way in).
    const presentTo = open ? 1 : 0
    if (presentTo !== presentGoal) {
      presentGoal = presentTo
      gsap.to(present, { v: presentTo, duration: dur(open ? 0.8 : 0.6), ease: 'power2.inOut', overwrite: true })
    }

    if (!active) {
      clearFrame()
      return
    }

    // Hover from the pointer (not while dragging), or the focused hotspot.
    if (!drag) hover = pointerPx ? pick(pointerPx.x, pointerPx.y) : -1
    const target = focusSlot >= 0 ? focusSlot : hover
    document.documentElement.style.cursor = hover >= 0 && !drag ? 'pointer' : drag?.moved ? 'grabbing' : ''
    if (target >= 0 && target !== shownSlot) {
      const r = machine.slots[target].rect
      frame.position.set(r.x, r.y, L.zFront + 0.03)
      shownSlot = target
    }
    const goal = target >= 0 ? 0.9 : 0
    frameOpacity.v += (goal - frameOpacity.v) * (opts.reducedMotion ? 1 : 0.25)
    if (Math.abs(goal - frameOpacity.v) < 0.005) frameOpacity.v = goal
    settling = frameOpacity.v !== goal
    frame.material.opacity = frameOpacity.v
    frame.visible = frameOpacity.v > 0.01

    // Each hotspot covers its whole door (the bounds of the projected corners), so the focus ring goes
    // around the door and its placard instead of through the product name.
    const m = machine.root.matrixWorld
    const sx = (p: THREE.Vector3) => (p.x * 0.5 + 0.5) * w
    const sy = (p: THREE.Vector3) => (-p.y * 0.5 + 0.5) * h
    buttons.forEach((b, i) => {
      const r = machine.slots[Number(b.dataset.slot)].rect
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const [cx, cy] of CORNERS) {
        v.set(r.x + (cx * r.w) / 2, r.y + (cy * r.h) / 2, L.zFront).applyMatrix4(m).project(camera)
        x0 = Math.min(x0, sx(v))
        x1 = Math.max(x1, sx(v))
        y0 = Math.min(y0, sy(v))
        y1 = Math.max(y1, sy(v))
      }
      const bx = Math.round(x0)
      const by = Math.round(y0)
      const bw = Math.round(x1) - bx
      const bh = Math.round(y1) - by
      const key = `${bx},${by},${bw},${bh}`
      if (placed[i] === key) return
      placed[i] = key
      b.style.width = `${bw}px`
      b.style.height = `${bh}px`
      b.style.transform = `translate(${bx}px, ${by}px)`
    })

    // Turn controls. Desktop: centered just under the machine's lowest point (the framing leaves room
    // for them). Phones: at the right edge on its plinth, clear of the wordmark and the copy below.
    v.set(0, 0, L.zFront).applyMatrix4(m).project(camera)
    const phone = w < 900
    const x = phone ? w - 16 : sx(v)
    let y = sy(v) - 8
    if (!phone) {
      let low = 0
      for (const p of base) low = Math.max(low, sy(v.copy(p).applyMatrix4(m).project(camera)))
      y = Math.min(h - pillH - 12, low + 12)
    }
    controls.style.translate = phone ? '-100% 0' : ''
    controls.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }

  return { yawOffset: () => yaw, present: () => present.v, update, reset, busy }
}
