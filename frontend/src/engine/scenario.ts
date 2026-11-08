import type { Fault } from './faults'
import { freshSim, step } from './simulation'
import type { LabNode, Wire } from './types'
import { validate } from './validation'

export interface RunSummary {
  days: number
  startSoc: number
  endSoc: number
  minSoc: number
  /** Inverter low-voltage shutdown happened. */
  lvd: boolean
  /** Inverter overload happened. */
  overload: boolean
  /** Number of RCD trips. */
  rcdTrips: number
  /** Grid energy and generator use over the run. */
  eImport: number
  eExport: number
  fuel: number
  genHours: number
  /** kWh over the whole run */
  eGen: number
  eUse: number
  /** Battery protection acted (BMS low cut-off or over-current). */
  bms: boolean
  /** Loads were shed (battery low or overload). */
  shed: boolean
  /** Inverter thermal protection tripped after sustained overload. */
  thermal: boolean
  /** Loads refused at start-up by a surge overload. */
  surge: boolean
}

/**
 * Run the simulation headlessly from Day 1 06:00 at ×1 speed (2-minute steps).
 * Deterministic for the same project, sky clearness and duration.
 */
export function simulateDays(nodes: LabNode[], wires: Wire[], days = 3, clear = 85, faults: readonly Fault[] = []): RunSummary {
  const v = validate(nodes, wires)
  let sim = freshSim()
  const startSoc = sim.soc
  let minSoc = sim.soc
  let lvd = false
  let overload = false
  let rcdTrips = 0
  let bms = false
  let shed = false
  let thermal = false
  let surge = false
  const end = sim.t + days * 24 * 60
  while (sim.t < end) {
    const before = sim.rcdTripped?.length ?? 0
    sim = step(sim, v, clear, 0, nodes, faults).sim
    rcdTrips += Math.max(0, (sim.rcdTripped?.length ?? 0) - before)
    minSoc = Math.min(minSoc, sim.soc)
    lvd ||= sim.lvd
    overload ||= !!sim.ovl
    bms ||= !!sim.bmsLow || !!sim.bmsOc
    shed ||= !!sim.shed?.length
    thermal ||= sim.thermalUntil !== undefined
    surge ||= !!sim.surgeBlocked?.length
  }
  return { days, startSoc, endSoc: sim.soc, minSoc, lvd, overload, rcdTrips, eGen: sim.eGen, eUse: sim.eUse, eImport: sim.eImport ?? 0, eExport: sim.eExport ?? 0, fuel: sim.fuel ?? 0, genHours: sim.genHours ?? 0, bms, shed, thermal, surge }
}
