/**
 * Appliance behaviour shared by the AC solver and the simulation (PRD §6.5): startup surge and
 * load priority. Priority 1 = essential (never shed), 2 = normal, 3 = non-essential.
 */
import type { LabNode } from './types'

export const PRIORITY_LABEL: Record<number, string> = { 1: 'Essential', 2: 'Normal', 3: 'Non-essential' }

/** Load priority, 1–3 (2 when unset). */
export const loadPriority = (l: LabNode) => Math.min(3, Math.max(1, Math.round(l.specs.priority || 2)))

/** Startup surge multiplier (× rated power, at least 1). */
export const surgeFactor = (l: LabNode) => Math.max(1, l.specs.surge || 1)

/** Peak power while the load starts, W. */
export const startPower = (l: LabNode) => l.specs.p * surgeFactor(l)

/** Sheddable loads in shedding order: priority 3 before 2, larger first, then by id (deterministic). */
export function loadOrderForShedding(group: readonly LabNode[]) {
  return group
    .filter((l) => loadPriority(l) >= 2)
    .sort((a, b) => loadPriority(b) - loadPriority(a) || b.specs.p - a.specs.p || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Loads that cannot start because the startup peak exceeds `surgeW`. `running` are the loads
 * already on the source, `starting` those switching on this tick. The largest surges are refused
 * first until the peak fits. `surgeW` 0 means the surge rating is unknown (not checked).
 */
export function surgeRefused(running: readonly LabNode[], starting: readonly LabNode[], surgeW: number) {
  if (!surgeW || !starting.length) return { refused: [] as LabNode[], peak: 0 }
  let peak = running.reduce((a, l) => a + l.specs.p, 0) + starting.reduce((a, l) => a + startPower(l), 0)
  const first = peak
  const refused: LabNode[] = []
  const order = [...starting].sort((a, b) => startPower(b) - startPower(a) || (a.id < b.id ? -1 : 1))
  for (const l of order) {
    if (peak <= surgeW) break
    refused.push(l)
    peak -= startPower(l)
  }
  return { refused, peak: first }
}
