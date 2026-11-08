import type { LabNode } from './types'

/** Loads whose daily schedule is on at hour `h` (schedules may wrap past midnight). */
export const scheduledOn = (l: LabNode, h: number) => {
  const a = l.specs.on
  const b = l.specs.off
  return a < b ? h >= a && h < b : h >= a || h < b
}
