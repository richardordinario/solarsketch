/**
 * Run-time state of inline devices: faults that hold a device open (blown fuse, tripped AC
 * breaker) and live meter readings. Both are derived from the shared engine (validation and the
 * flow solver), so the 2D canvas, the inspector and the 3D view show the same numbers.
 */
import { CATALOG, isPv } from './catalog'
import type { Fault } from './faults'
import { wireFlows } from './flows'
import { OPENING_FAULTS } from './inline'
import type { Measurements } from './simulation'
import type { Wire } from './types'
import { validate, type ValidationResult } from './validation'

/** Node ids an active fault holds open. */
export function openedByFaults(act: readonly Fault[]): Set<string> {
  return new Set(act.filter((f) => (OPENING_FAULTS as readonly string[]).includes(f.kind)).map((f) => f.target))
}

let cache: { v: ValidationResult; key: string; result: ValidationResult } | null = null

/**
 * The validation result with fault-opened devices treated as open, so everything beyond a blown
 * fuse or a tripped breaker loses supply exactly as if it were switched off. Memoised.
 */
export function faultedValidation(v: ValidationResult, act: readonly Fault[]): ValidationResult {
  const open = openedByFaults(act)
  if (!open.size || !v.nodes) return v
  const key = [...open].sort().join()
  if (cache && cache.v === v && cache.key === key) return cache.result
  const nodes = v.nodes.map((n) => (open.has(n.id) && CATALOG[n.type].sw ? { ...n, specs: { ...n.specs, closed: 0 } } : n))
  const result = validate(nodes, v.wires)
  cache = { v, key, result }
  return result
}

export interface MeterReading {
  /** Volts (0 when the voltage sense or supply is missing). */
  v: number
  /** Amps through the meter; + = towards the load side. */
  a: number
  /** Watts; + = consumption, − = charging or export. */
  w: number
}

const METER_TYPES = ['dcm', 'acm', 'ctm']

/** Signed current into terminal (n, t) from its wires. */
function inflow(flows: ReturnType<typeof wireFlows>, wires: readonly Wire[], n: string, t: string) {
  let a = 0
  for (const w of wires) {
    const f = flows[w.id]
    if (!f) continue
    if (w.a.n === n && w.a.t === t) a -= f.amps * f.dir
    if (w.b.n === n && w.b.t === t) a += f.amps * f.dir
  }
  return a
}

/**
 * Live readings of DC shunt meters and AC energy meters, from the same flow solution the canvas
 * animates. A DC meter measures the current returning through its shunt from the load side; its
 * voltage needs the V+ sense wire. An AC or CT meter reads the current leaving its L out terminal
 * (for a CT meter at the grid connection: + = import, − = export).
 */
export function readMeters(v: ValidationResult, m: Measurements, t: number, faults: readonly Fault[]): Record<string, MeterReading> {
  const nodes = v.nodes ?? []
  const meters = nodes.filter((n) => METER_TYPES.includes(n.type))
  if (!meters.length) return {}
  const flows = wireFlows(nodes, v.wires, v, m, t, faults)
  const net = v.sys.ac.netOf
  const out: Record<string, MeterReading> = {}
  for (const n of meters) {
    if (n.type === 'dcm') {
      const a = inflow(flows, v.wires, n.id, 'ln')
      const sensed = v.wires.some((w) => (w.a.n === n.id && w.a.t === 'vp') || (w.b.n === n.id && w.b.t === 'vp'))
      const onPv = nodes.some((x) => (isPv(x) && net(x.id, 'n') === net(n.id, 'ln')) || (['mppt', 'pwm', 'gti', 'hyb', 'mi'].includes(x.type) && net(x.id, 'pvn') === net(n.id, 'ln')))
      const volts = sensed ? (onPv ? m.vpv : m.vbat) : 0
      out[n.id] = { v: volts, a, w: volts * a }
    } else {
      const live = (m.ac.liveDevices ?? []).includes(n.id)
      const volts = live ? (v.sys.inv?.specs.acV ?? 230) : 0
      const a = live ? -inflow(flows, v.wires, n.id, 'lo') : 0
      out[n.id] = { v: volts, a, w: volts * a }
    }
  }
  return out
}
