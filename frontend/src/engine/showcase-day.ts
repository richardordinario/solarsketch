import { TEMPLATES } from './sample-project'
import { freshSim, step, type SimState } from './simulation'
import type { ComponentType, LabNode, Wire } from './types'
import { validate, type ValidationResult } from './validation'

/** Template shown on the landing page. */
export const SHOWCASE_TEMPLATE = 'hybrid-solar'

/** Clear-sky setting for the showcase day, % (the lab's default). */
export const SHOWCASE_CLEAR = 85

/** Simulation step for the showcase day, minutes. */
const DT = 5

/** Scroll progress (0–1) to the showcase clock in hours: 05:30 at the top of the page, 19:00 at the bottom. */
export const showcaseHour = (p: number) => 5.5 + Math.min(1, Math.max(0, p)) * 13.5

export interface ShowcaseDay {
  name: string
  nodes: LabNode[]
  wires: Wire[]
  v: ValidationResult
  /** Simulation state every DT minutes over one day, starting at 00:00, after a warm-up day. */
  states: SimState[]
}

/** Runs the landing-page template through the engine for two days and keeps the second (settled) one. */
export function showcaseDay(): ShowcaseDay {
  const tpl = TEMPLATES.find((x) => x.id === SHOWCASE_TEMPLATE)!
  const { nodes, wires } = tpl.build()
  const v = validate(nodes, wires)
  let sim: SimState = { ...freshSim(), t: 0 }
  const states: SimState[] = []
  for (let t = 0; t < 2 * 1440; t += DT) {
    if (t >= 1440) states.push(sim)
    sim = step(sim, v, SHOWCASE_CLEAR, 0, nodes, [], DT).sim
  }
  return { name: tpl.name, nodes, wires, v, states }
}

/** State at `hour` (0–24) of the showcase day. */
export function stateAt(day: ShowcaseDay, hour: number) {
  const i = Math.min(day.states.length - 1, Math.max(0, Math.round((hour * 60) / DT)))
  return day.states[i]
}

/**
 * Camera shots of the landing-page tour, by clock hour. A shot without `focus` frames the whole
 * house; with `focus` the camera closes in on those component types. `az` is the angle around the
 * vertical axis from straight in front of the house (+z), `el` the angle above the horizon, both
 * in radians, and `dist` the distance from the focus in metres.
 */
export interface ShowcaseShot {
  hour: number
  focus?: readonly ComponentType[]
  label?: string
  az: number
  el: number
  dist?: number
}

export const SHOWCASE_SHOTS: readonly ShowcaseShot[] = [
  { hour: 5.5, az: 0.55, el: 0.42 },
  { hour: 6, focus: ['pv'], label: 'PV array', az: 0.35, el: 0.8, dist: 7.6 },
  { hour: 9, focus: ['acdb', 'nm'], label: 'AC board and net meter', az: -0.2, el: 0.2, dist: 3.4 },
  { hour: 12, focus: ['hyb'], label: 'Hybrid inverter', az: -0.45, el: 0.2, dist: 3.3 },
  { hour: 15, focus: ['bat'], label: 'Battery bank', az: -0.9, el: 0.5, dist: 3 },
  { hour: 17.5, focus: ['fridge', 'fan', 'tv', 'led'], label: 'House loads', az: 0.7, el: 0.3, dist: 5.2 },
  { hour: 19, az: -0.75, el: 0.4 },
]

/** The shot the camera is at, or heading to, at `hour`. */
export function shotAt(hour: number) {
  return SHOWCASE_SHOTS.reduce((best, s) => (Math.abs(s.hour - hour) < Math.abs(best.hour - hour) ? s : best))
}
