import type { MachineConfig } from './config.ts'

export interface OuterDims {
  W: number
  H: number
  D: number
}

export interface SlotRect {
  index: number
  row: number // 0 = top row
  col: number // 0 = left column
  x: number // center
  y: number // center
  w: number
  h: number
  left: number
  right: number
  top: number
  bottom: number
}

export interface Layout extends OuterDims {
  feet: number // leveling-feet height
  skinBottom: number // underside of the molded body (top of the recessed plinth)
  zFront: number // bezel front face
  zBack: number // rear face
  cavityBack: number // inner back of every slot cavity
  slotTop: number // top edge of the slot grid
  mullionX: number[] // centerlines of the mullions between columns
  sideX: [number, number] // centerlines of the left and right side frames
  slots: SlotRect[]
}

// W = cols·slot.w + (cols−1)·mullion + 2·side
// H = rows·slot.h + (rows−1)·rail + header + plinth
// D = back + slot.d + front
export function outerDims(cfg: MachineConfig): OuterDims {
  const { slot, grid, cabinet: c } = cfg
  return {
    W: grid.cols * slot.w + (grid.cols - 1) * c.mullion + 2 * c.side,
    H: grid.rows * slot.h + (grid.rows - 1) * c.rail + c.header + c.plinth,
    D: c.back + slot.d + c.front,
  }
}

export function layout(cfg: MachineConfig): Layout {
  const { W, H, D } = outerDims(cfg)
  const { slot, grid, cabinet: c } = cfg
  const feet = 0.02
  const skinBottom = 0.05
  const zFront = D / 2 - c.front
  const zBack = -D / 2
  const slotTop = H - c.header
  const left0 = -W / 2 + c.side

  const slots: SlotRect[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const left = left0 + col * (slot.w + c.mullion)
      const top = slotTop - row * (slot.h + c.rail)
      slots.push({
        index: row * grid.cols + col,
        row,
        col,
        x: left + slot.w / 2,
        y: top - slot.h / 2,
        w: slot.w,
        h: slot.h,
        left,
        right: left + slot.w,
        top,
        bottom: top - slot.h,
      })
    }
  }

  const mullionX: number[] = []
  for (let k = 0; k < grid.cols - 1; k++) {
    mullionX.push(left0 + (k + 1) * slot.w + k * c.mullion + c.mullion / 2)
  }

  return {
    W,
    H,
    D,
    feet,
    skinBottom,
    zFront,
    zBack,
    cavityBack: zBack + c.back,
    slotTop,
    mullionX,
    sideX: [-W / 2 + c.side / 2, W / 2 - c.side / 2],
    slots,
  }
}
