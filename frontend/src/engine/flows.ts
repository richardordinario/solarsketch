/**
 * Current in every wire, for the flow animation. Derived from one `compute()` result, so it
 * shares the simulation's numbers; it never decides anything electrical itself.
 *
 * Each component injects a current into the wiring at its terminals (+ = out of the component).
 * Terminals bonded inside a component (busbars, a closed breaker, meters, the active side of a
 * transfer switch) form one vertex. Within each wired network the wire currents follow from a
 * spanning tree: the current in a wire is the sum of the injections on its far side. The tree is
 * rooted at the component whose current is least certain (battery, hybrid or inverter), so
 * modelling slack ends up there instead of on a wire. Parallel paths that close a loop get 0.
 */
import { activeFaults, faultOn, type Fault } from './faults'
import type { Measurements } from './simulation'
import type { LabNode, Wire } from './types'
import type { ValidationResult } from './validation'
import { BATTERY_TYPES, conductiveGroups } from './catalog'
import { OPENING_FAULTS } from './inline'

export interface WireFlow {
  /** Current, A (always > 0 in the result). */
  amps: number
  /** 1 when current flows from end a to end b, −1 the other way. */
  dir: 1 | -1
}

/** Below this current a wire is shown as idle. */
export const FLOW_MIN_A = 0.02
const AC_V = 230

const K = (n: string, t: string) => n + ':' + t

/** Root preference: lower is better. */
const ROOT_RANK: Partial<Record<string, number>> = { ...Object.fromEntries(BATTERY_TYPES.map((t) => [t, 0])), hyb: 1, inv: 2, gen: 3, grid: 4, gti: 5 }

export function wireFlows(nodes: readonly LabNode[], wires: readonly Wire[], v: ValidationResult, m: Measurements, t: number, faults: readonly Fault[] = []): Record<string, WireFlow> {
  const s = v.sys
  const act = activeFaults(faults, t)
  const inj = new Map<string, number>()
  const add = (n: string, tid: string, a: number) => {
    if (a) inj.set(K(n, tid), (inj.get(K(n, tid)) ?? 0) + a)
  }
  const pair = (n: string, plus: string, minus: string, a: number) => {
    add(n, plus, a)
    add(n, minus, -a)
  }

  // ---- PV strings: a set of strings delivers `pdc` watts at the strings' operating voltage.
  const stringVolts = (ch: LabNode[]) => ch.reduce((a, p) => a + ((m.moduleFactor[p.id] ?? 1) >= 0.5 ? p.specs.vmp : 0), 0) * (0.92 + (0.08 * m.G) / 1000)
  const drive = (strings: LabNode[][], pdc: number) => {
    const live = strings.filter((ch) => ch.every((p) => (m.moduleFactor[p.id] ?? 1) > 0))
    const vs = Math.max(0, ...live.map(stringVolts))
    if (!vs || pdc <= 0) return 0
    const weight = live.map((ch) => Math.min(...ch.map((p) => p.specs.isc * (m.moduleFactor[p.id] ?? 1))))
    const total = weight.reduce((a, b) => a + b, 0) || 1
    const itot = pdc / vs
    live.forEach((ch, i) => ch.forEach((p) => pair(p.id, 'p', 'n', (itot * weight[i]) / total)))
    return itot
  }

  const vbat = m.vbat
  if (s.ok && s.cc && vbat > 0) {
    const ipv = drive(s.strings, m.cc > 0 ? m.cc / (s.cc.specs.eff / 100) : 0)
    pair(s.cc.id, 'pvn', 'pvp', ipv)
    pair(s.cc.id, 'bp', 'bn', m.cc / vbat)
  }

  // ---- Battery bank: discharge current shared by its parallel strings.
  const bank = s.bank ?? s.invBank
  if (bank && vbat > 0 && !m.bmsOff) {
    const ib = -m.pbat / vbat / bank.strings.length
    bank.strings.forEach((st) => st.forEach((b) => pair(b.id, 'p', 'n', ib)))
  }

  // ---- Off-grid inverter.
  if (s.inv && vbat > 0 && !m.dcOff) {
    pair(s.inv.id, 'dn', 'dp', m.ac.pinv / vbat)
    if (m.ac.invOn) pair(s.inv.id, 'l', 'n', (m.ac.pinv * (s.inv.specs.eff / 100)) / AC_V)
  }

  // ---- Hybrid inverter: PV and battery ports (its AC ports are tree roots).
  const hyb = s.ac.hyb
  if (hyb) {
    const ipv = drive(hyb.strings, m.ac.hybPv / (hyb.node.specs.eff / 100))
    pair(hyb.node.id, 'pvn', 'pvp', ipv)
    if (vbat > 0) pair(hyb.node.id, 'bp', 'bn', m.ac.hybBattery / vbat)
  }

  // ---- Grid-tied inverters, grid and generator.
  if (s.ac.gtis.length && m.ac.gtiAc > 0) {
    const each = m.ac.gtiAc / s.ac.gtis.length
    s.ac.gtis.forEach((g) => {
      const ipv = drive(g.strings, each / (g.node.specs.eff / 100))
      pair(g.node.id, 'pvn', 'pvp', ipv)
      pair(g.node.id, 'l', 'n', each / AC_V)
    })
  }
  s.ac.grids.forEach((g) => pair(g.id, 'l', 'n', m.ac.pgrid / s.ac.grids.length / AC_V))
  s.ac.gens.forEach((g) => pair(g.id, 'l', 'n', m.ac.pgen / s.ac.gens.length / AC_V))

  // ---- Loads.
  m.onLoads.forEach((l) => pair(l.id, 'n', 'l', l.specs.p / AC_V))

  // ---- Vertices: terminals bonded inside a component.
  const par = new Map<string, string>()
  const find = (k: string): string => {
    let r = k
    while (par.has(r) && par.get(r) !== r) r = par.get(r)!
    par.set(k, r)
    return r
  }
  const bond = (n: string, a: string, b: string) => par.set(find(K(n, a)), find(K(n, b)))
  const opened = new Set(act.filter((f) => (OPENING_FAULTS as readonly string[]).includes(f.kind)).map((f) => f.target))
  for (const n of nodes) {
    // Busbars and conducting inline devices (closed switches, intact fuses, meters, connectors).
    conductiveGroups(n, opened).forEach(([first, ...rest]) => rest.forEach((x) => bond(n.id, first, x)))
    if (n.type === 'dcb' && !faultOn(act, n.id, 'breaker-trip')) bond(n.id, 'i', 'o')
    if (n.type === 'nm') {
      bond(n.id, 'gl', 'l')
      bond(n.id, 'gn', 'n')
    }
    if (n.type === 'ats') {
      const side = m.ac.atsSide[n.id]
      if (side === 'main') (bond(n.id, 'l', 'ml'), bond(n.id, 'n', 'mn'))
      if (side === 'backup') (bond(n.id, 'l', 'bl'), bond(n.id, 'n', 'bkn'))
    }
  }

  // ---- Tree sums per wired network.
  const adj = new Map<string, { w: Wire; to: string }[]>()
  for (const w of wires) {
    const a = find(K(w.a.n, w.a.t))
    const b = find(K(w.b.n, w.b.t))
    if (a === b) continue
    adj.set(a, [...(adj.get(a) ?? []), { w, to: b }])
    adj.set(b, [...(adj.get(b) ?? []), { w, to: a }])
  }
  const vInj = new Map<string, number>()
  inj.forEach((a, k) => vInj.set(find(k), (vInj.get(find(k)) ?? 0) + a))
  const typeOf = new Map(nodes.map((n) => [n.id, n.type]))
  const rankOf = (vtx: string) => {
    let best = 99
    par.forEach((_, k) => {
      if (find(k) === vtx) best = Math.min(best, ROOT_RANK[typeOf.get(k.split(':')[0]) ?? ''] ?? 99)
    })
    return Math.min(best, ROOT_RANK[typeOf.get(vtx.split(':')[0]) ?? ''] ?? 99)
  }

  const out: Record<string, WireFlow> = {}
  const seen = new Set<string>()
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    // Collect the network, then pick its root.
    const comp: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const x = stack.pop()!
      comp.push(x)
      for (const { to } of adj.get(x) ?? []) if (!seen.has(to)) (seen.add(to), stack.push(to))
    }
    const root = comp.reduce((best, x) => (rankOf(x) < rankOf(best) ? x : best), comp[0])
    // BFS tree from the root, then accumulate subtree injections leaves-first.
    const parentEdge = new Map<string, { w: Wire; from: string }>()
    const order = [root]
    const inTree = new Set([root])
    for (let i = 0; i < order.length; i++) {
      for (const { w, to } of adj.get(order[i]) ?? []) {
        if (inTree.has(to)) continue
        inTree.add(to)
        parentEdge.set(to, { w, from: order[i] })
        order.push(to)
      }
    }
    const sub = new Map(order.map((x) => [x, vInj.get(x) ?? 0]))
    for (let i = order.length - 1; i > 0; i--) {
      const x = order[i]
      const { w, from } = parentEdge.get(x)!
      const a = sub.get(x)!
      sub.set(from, sub.get(from)! + a)
      if (Math.abs(a) < FLOW_MIN_A) continue
      // Positive `a` flows from this child vertex up to its parent.
      const childIsA = find(K(w.a.n, w.a.t)) === x
      out[w.id] = { amps: Math.abs(a), dir: (a > 0) === childIsA ? 1 : -1 }
    }
  }
  return out
}
