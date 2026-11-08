import { terminal } from './geometry'
import type { Wire } from './types'
import type { NodeMap, ValidationResult } from './validation'

/**
 * Display-only wire visibility for troubleshooting busy sheets. It never feeds validation
 * or simulation: a hidden wire is still part of the circuit.
 */
export type WireViewMode = 'all' | 'focus' | 'hidden'
export type WireDomain = 'dc' | 'ac' | 'pe'

export interface WireFilter {
  /** all: every wire; focus: wires of the selection, the rest faded; hidden: no wires. */
  mode: WireViewMode
  domains: Record<WireDomain, boolean>
  /** Show only wires that fail a connection check. */
  problemsOnly: boolean
}

export const DEFAULT_WIRE_FILTER: WireFilter = { mode: 'all', domains: { dc: true, ac: true, pe: true }, problemsOnly: false }

export type WireVisibility = 'show' | 'dim' | 'hide'

/** DC, AC or protective earth, from the wire's terminal types. */
export function wireDomain(w: Wire, nm: NodeMap): WireDomain {
  const ta = nm[w.a.n] && terminal(nm[w.a.n], w.a.t)?.t
  const tb = nm[w.b.n] && terminal(nm[w.b.n], w.b.t)?.t
  if (ta === 'pe' || tb === 'pe') return 'pe'
  if (ta?.startsWith('ac') || tb?.startsWith('ac')) return 'ac'
  return 'dc'
}

export function isFilterActive(f: WireFilter) {
  return f.mode !== 'all' || f.problemsOnly || !f.domains.dc || !f.domains.ac || !f.domains.pe
}

/** How each wire is drawn under the filter. The selected wire is always shown. */
export function wireVisibility(wires: Wire[], nm: NodeMap, v: ValidationResult, f: WireFilter, sel: { nodes: string[]; wire: string | null }): Record<string, WireVisibility> {
  const out: Record<string, WireVisibility> = {}
  const focus = f.mode === 'focus' && (sel.nodes.length > 0 || !!sel.wire)
  for (const w of wires) {
    if (w.id === sel.wire) {
      out[w.id] = 'show'
      continue
    }
    if (f.mode === 'hidden' || !f.domains[wireDomain(w, nm)] || (f.problemsOnly && !v.wres[w.id]?.fail)) {
      out[w.id] = 'hide'
      continue
    }
    out[w.id] = focus && !sel.nodes.includes(w.a.n) && !sel.nodes.includes(w.b.n) ? 'dim' : 'show'
  }
  return out
}
