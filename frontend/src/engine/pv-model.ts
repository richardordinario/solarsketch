/**
 * Simplified PV module model (PRD §6.2). The base stays P_PV = P_STC × (G ÷ 1000) × f; this
 * module adds the module temperature, orientation and bifacial gain as separate factors.
 *
 * Assumptions (stated to the learner in the inspector):
 * - Ambient temperature follows a fixed lowland-Philippines day: about 24 °C before dawn, 32 °C at 14:00.
 * - Cell temperature uses the NOCT approximation T_cell = T_amb + (NOCT − 20) ÷ 800 × G.
 * - Power changes linearly with cell temperature (coefficient tcP, %/°C, from 25 °C);
 *   voltage changes with tcVoc.
 * - Orientation gives a fixed yearly factor from tilt and azimuth (180° = facing south); it is
 *   an educational approximation for a site near 12° N, not a sun-position model.
 * - The cold-temperature Voc check uses a design minimum of 15 °C. Highland sites get colder.
 * A spec stored as 0 (not published for a real device) switches its effect off.
 */
import type { LabNode } from './types'

/** Combined losses other than temperature and orientation: soiling, wiring, mismatch, ageing. */
export const PERFORMANCE_FACTOR = 0.88
/** STC cell temperature, °C. */
export const STC_TEMP = 25
/** Design minimum cell temperature for the cold-morning Voc check, °C. */
export const DESIGN_MIN_TEMP = 15
/** NOCT used when a module's NOCT is not published, °C. */
export const DEFAULT_NOCT = 45
/** Latitude the orientation factor is tuned for, degrees north. */
export const SITE_LATITUDE = 12

/** Ambient temperature at hour `h`, °C. */
export function ambientTemp(h: number) {
  return 28 + 4 * Math.cos((2 * Math.PI * (h - 14)) / 24)
}

/** Cell temperature for irradiance G (W/m²) at hour h, °C. */
export function cellTemp(node: LabNode, G: number, h: number) {
  const noct = node.specs.noct || DEFAULT_NOCT
  return ambientTemp(h) + ((noct - 20) / 800) * G
}

/** Power multiplier from cell temperature (1 at 25 °C). */
export function tempFactor(node: LabNode, tcell: number) {
  return Math.max(0, 1 + ((node.specs.tcP || 0) / 100) * (tcell - STC_TEMP))
}

/** Voltage multiplier from cell temperature (1 at 25 °C). */
export function voltTempFactor(node: LabNode, tcell: number) {
  return Math.max(0, 1 + ((node.specs.tcVoc || 0) / 100) * (tcell - STC_TEMP))
}

/** Fixed orientation factor from tilt (°) and azimuth (°, 180 = south), 0.2–1. */
export function orientationFactor(node: LabNode) {
  const tilt = Math.max(0, Math.min(90, node.specs.tilt ?? 10))
  const az = node.specs.azimuth ?? 180
  const off = (Math.abs((((az - 180) % 360) + 540) % 360 - 180) * Math.PI) / 180
  const f = 1 - 0.00008 * (tilt - SITE_LATITUDE) ** 2 - 0.5 * Math.sin((tilt * Math.PI) / 180) * ((1 - Math.cos(off)) / 2)
  return Math.max(0.2, Math.min(1, f))
}

/** Bifacial rear-side gain multiplier (1 for single-sided modules). */
export const bifacialFactor = (node: LabNode) => 1 + Math.max(0, node.specs.bifi || 0) / 100

/** Open-circuit voltage at the design minimum temperature, V. */
export const coldVoc = (node: LabNode) => node.specs.voc * voltTempFactor(node, DESIGN_MIN_TEMP)

/** Output of one healthy module before shading: P_STC × G/1000 × f × temperature × orientation × bifacial. */
export function moduleDcPower(node: LabNode, G: number, h: number) {
  if (G <= 0) return 0
  const tc = cellTemp(node, G, h)
  return ((node.specs.ratedPower * G) / 1000) * PERFORMANCE_FACTOR * tempFactor(node, tc) * orientationFactor(node) * bifacialFactor(node)
}
