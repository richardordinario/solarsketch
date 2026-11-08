/**
 * Runtime fault scenarios (PRD P2 "Advanced fault scenarios"). Faults are project data, so a
 * challenge can ship hidden faults the learner must diagnose with measurements and repair.
 * Effects are applied by simulation.ts; nothing here is installation guidance.
 */
import { BATTERY_TYPES, CATALOG, LOAD_TYPES, PV_TYPES } from './catalog'
import type { ComponentType, LabNode } from './types'

export type FaultKind = 'shading' | 'module-open' | 'breaker-trip' | 'bms-cutoff' | 'ground-fault' | 'inverter-overtemp' | 'grid-outage' | 'gen-fail' | 'fuse-blown' | 'ac-breaker-trip'

export interface Fault {
  id: string
  kind: FaultKind
  /** Node the fault affects. */
  target: string
  /** Simulated minutes (from Day 1 00:00) when the fault begins; absent = from the start. */
  startAt?: number
  /** Shaded fraction for `shading`, 0–1. */
  shade?: number
  /** Hidden faults (challenges) are not listed; only their symptoms show. */
  hidden?: boolean
}

export interface FaultDef {
  label: string
  appliesTo: ComponentType[]
  /** What the learner observes. */
  symptom: string
  /** What fixes it in the lab. */
  repair: string
}

export const FAULT_DEFS: Record<FaultKind, FaultDef> = {
  shading: {
    label: 'Partial shading',
    appliesTo: [...PV_TYPES],
    symptom: 'The shaded module produces less power; with bypass diodes a heavily shaded module drops out of the string voltage.',
    repair: 'Clear the shading (trim vegetation, clean or relocate the module).',
  },
  'module-open': {
    label: 'Failed module (open circuit)',
    appliesTo: [...PV_TYPES],
    symptom: 'The whole series string stops producing: the module measures 0 V open-circuit in daylight.',
    repair: 'Replace the failed module.',
  },
  'breaker-trip': {
    label: 'DC breaker tripped',
    appliesTo: ['dcb'],
    symptom: 'The inverter loses its DC supply, so every AC load goes off while charging continues.',
    repair: 'Find the cause, then reset the breaker.',
  },
  'bms-cutoff': {
    label: 'Battery BMS cut-off',
    appliesTo: [...BATTERY_TYPES],
    symptom: 'The battery disconnects itself: no charging and no inverter output; the bank terminals read 0 V.',
    repair: 'Check the battery, then reset the BMS.',
  },
  'ground-fault': {
    label: 'Earth leakage in appliance',
    appliesTo: [...LOAD_TYPES],
    symptom: 'When the appliance switches on, leakage to earth trips the board’s RCD and every load on that board goes off.',
    repair: 'Repair the appliance, then reset the RCD.',
  },
  'grid-outage': {
    label: 'Grid outage (brownout)',
    appliesTo: ['grid'],
    symptom: 'The utility supply drops. Grid-tied inverters shut down (anti-islanding); a hybrid switches its loads to battery; a transfer switch moves to the generator.',
    repair: 'Wait for the utility to restore supply (remove the fault).',
  },
  'gen-fail': {
    label: 'Generator fails to start',
    appliesTo: ['gen'],
    symptom: 'The generator is called to start but never comes online, so backup power is unavailable.',
    repair: 'Service the generator (fuel, battery, spark plug).',
  },
  'inverter-overtemp': {
    label: 'Inverter over-temperature',
    appliesTo: ['inv'],
    symptom: 'The inverter derates to 50% of its continuous rating; larger loads trip it on overload.',
    repair: 'Clear the blocked ventilation.',
  },
  'fuse-blown': {
    label: 'DC fuse blown',
    appliesTo: ['fuse'],
    symptom: 'Everything beyond the fuse loses DC supply; the fuse reads the full circuit voltage across it and no continuity.',
    repair: 'Find the cause of the overcurrent, then replace the fuse with one of the same rating.',
  },
  'ac-breaker-trip': {
    label: 'AC breaker tripped',
    appliesTo: ['mcb', 'mccb'],
    symptom: 'Every load on the breaker’s circuit goes off; the breaker’s load side reads 0 V.',
    repair: 'Find the overload or short circuit, then reset the breaker.',
  },
}

export const FAULT_KINDS = Object.keys(FAULT_DEFS) as FaultKind[]

export const isActive = (f: Fault, t: number) => (f.startAt ?? -Infinity) <= t

export function activeFaults(faults: readonly Fault[], t: number) {
  return faults.filter((f) => isActive(f, t))
}

export const faultOn = (faults: readonly Fault[], nodeId: string, kind: FaultKind) => faults.find((f) => f.target === nodeId && f.kind === kind)

export function describeFault(f: Fault, node: LabNode | undefined) {
  const where = node ? CATALOG[node.type].name : 'Unknown component'
  return `${FAULT_DEFS[f.kind].label} on ${where}${f.kind === 'shading' ? ` (${Math.round((f.shade ?? 0.5) * 100)}% shaded)` : ''}`
}

/** Faults whose target no longer exists are dropped. */
export function pruneFaults(faults: readonly Fault[], nodes: readonly LabNode[]) {
  const ids = new Set(nodes.map((n) => n.id))
  return faults.filter((f) => ids.has(f.target))
}
