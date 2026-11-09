import { CATALOG, LOAD_TYPES } from './catalog'
import type { ComponentType, LabNode } from './types'

/**
 * Rough project cost estimate in Philippine pesos. Prices are **illustrative example values**
 * for learning (roughly local retail), not quotes or real supplier prices. Sized items scale
 * with their specs so editing a rating changes the estimate. Wiring and labour are not included.
 */

/** How one unit is priced: a flat price, or a rate times a spec-derived size. */
type Price = { flat: number } | { per: number; size: (s: Record<string, number>) => number }

const perW = (per: number, key = 'ratedPower'): Price => ({ per, size: (s) => s[key] ?? 0 })
const perKwh = (per: number): Price => ({ per, size: (s) => ((s.nomV ?? 0) * (s.ah ?? 0)) / 1000 })
const perA = (per: number, key = 'maxI'): Price => ({ per, size: (s) => s[key] ?? 0 })
const flat = (v: number): Price => ({ flat: v })

/**
 * Types left out of the estimate: the utility service (the distribution utility's pole and
 * line, e.g. Meralco) and the earth itself at the grounding rod.
 */
export const UNPRICED: readonly ComponentType[] = ['grid', 'gnd']

const PRICES: Record<Exclude<ComponentType, 'grid' | 'gnd'>, Price> = {
  pv: perW(12),
  pvpoly: perW(11),
  pvbif: perW(13),
  pvflex: perW(25),
  pvport: perW(30),
  mppt: perA(150),
  pwm: perA(50),
  bat: perKwh(9000),
  batnmc: perKwh(10000),
  batfla: perKwh(4500),
  batagm: perKwh(6000),
  batgel: perKwh(7000),
  inv: perW(6, 'ratedP'),
  hyb: perW(9, 'ratedP'),
  gti: perW(7, 'ratedP'),
  mi: flat(9000),
  gen: perW(10, 'ratedP'),
  dcb: flat(900),
  acdb: flat(2500),
  outlet: flat(250),
  nm: flat(6000),
  ats: flat(6500),
  mc4: flat(150),
  ybr: flat(450),
  fuse: flat(1200),
  iso: flat(1800),
  dspd: flat(1500),
  mcb: flat(350),
  mccb: flat(2500),
  rccb: flat(1500),
  aspd: flat(1200),
  acsw: flat(1200),
  cbx: flat(6000),
  dbus: flat(2000),
  pebar: flat(300),
  dcm: flat(1500),
  acm: flat(1200),
  ctm: flat(3500),
  led: flat(300),
  fan: flat(1500),
  fridge: flat(15000),
  tv: flat(12000),
  acw: flat(18000),
  acs: flat(30000),
  pc: flat(30000),
  laptop: flat(30000),
  router: flat(1500),
  rice: flat(1500),
  kettle: flat(1000),
  micro: flat(5000),
  induc: flat(2500),
  wash: flat(7000),
  iron: flat(800),
  pump: flat(4500),
}

/** Example unit price of one placed component, or null when it is left out of the estimate. */
export function unitPrice(n: LabNode): number | null {
  if (UNPRICED.includes(n.type)) return null
  const p = PRICES[n.type as keyof typeof PRICES]
  if (!p) return null
  const v = 'flat' in p ? p.flat : p.per * Math.max(0, p.size(n.specs))
  return Math.round(v / 10) * 10
}

export interface CostLine {
  type: ComponentType
  name: string
  qty: number
  /** Sum for all units of this type (units may differ when their specs differ). */
  amount: number
}

export interface CostEstimate {
  lines: CostLine[]
  /** Solar and electrical equipment (everything except loads). */
  equipment: number
  /** Appliances (catalog loads). */
  appliances: number
  total: number
  /** Number of placed components left out (utility grid, grounding rod). */
  excluded: number
}

export function estimateCost(nodes: readonly LabNode[]): CostEstimate {
  const byType = new Map<ComponentType, CostLine>()
  let excluded = 0
  for (const n of nodes) {
    const price = unitPrice(n)
    if (price === null) {
      excluded++
      continue
    }
    const line = byType.get(n.type) ?? { type: n.type, name: CATALOG[n.type].name, qty: 0, amount: 0 }
    line.qty++
    line.amount += price
    byType.set(n.type, line)
  }
  const lines = [...byType.values()].sort((a, b) => b.amount - a.amount)
  const appliances = lines.filter((l) => LOAD_TYPES.includes(l.type)).reduce((a, l) => a + l.amount, 0)
  const total = lines.reduce((a, l) => a + l.amount, 0)
  return { lines, equipment: total - appliances, appliances, total, excluded }
}

export const peso = (v: number) => `₱${Math.round(v).toLocaleString('en-PH')}`
