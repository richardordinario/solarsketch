/**
 * Inline and shunt devices (PRD §4.1 B, F, G, H, J): connectors, combiners, fuses, isolators,
 * breakers, RCCBs, surge protectors, busbars and meters.
 *
 * Electrically they are conductors between their own terminals (`bus`, or `sw` while closed), so
 * the graph in validation.ts simply joins through them. This module adds what the plain graph
 * cannot see: the current a device carries (walking outward through other conductors to the
 * sources and loads behind each side), its current and voltage ratings, surge-protector earthing
 * and placement, combiner string fuses, and open switches. Deterministic and rule-based.
 */
import { AMPACITY, CATALOG, LOAD_TYPES, SWITCH_SPEC, conductiveGroups, isPv } from './catalog'
import type { ComponentType, Issue, LabNode, Severity, Wire } from './types'

/** Overcurrent devices: the rating is a protection setting (PRT-010). */
export const PROTECTIVE: readonly ComponentType[] = ['fuse', 'mcb', 'mccb']
/** Devices with an on/off position (`closed` spec). */
export const SWITCHED: readonly ComponentType[] = (Object.keys(CATALOG) as ComponentType[]).filter((k) => CATALOG[k].specs.some((s) => s[0] === SWITCH_SPEC))
/** AC devices whose supply side the AC solver reports live. */
export const AC_INLINE: readonly ComponentType[] = ['mcb', 'mccb', 'rccb', 'acsw', 'acm', 'aspd']
/** Surge protective devices. */
export const SPD_TYPES: readonly ComponentType[] = ['dspd', 'aspd']
/**
 * Pass-through devices that do not set a circuit current themselves; the current on their wires
 * is found by walking to what is behind them (RAT-020 checks their ratings).
 */
export const PASS_TYPES: readonly ComponentType[] = ['mc4', 'ybr', 'cbx', 'iso', 'acsw', 'rccb', 'dbus', 'dcm', 'acm']
/** Every component that only conducts between its terminals. */
const CONDUCTORS = new Set<ComponentType>([...PASS_TYPES, ...PROTECTIVE, 'dcb', 'outlet', 'acdb'])
/** DC devices with a maximum voltage rating (PRT-011). */
const DC_VRATED: readonly ComponentType[] = ['mc4', 'ybr', 'cbx', 'fuse', 'iso', 'dspd', 'dbus', 'dcm']
/** PV design current: modules can deliver more than Isc in strong sun (NEC 690.8 factor). */
export const PV_CURRENT_FACTOR = 1.25
/** Combiner string fuse window, multiples of module Isc (IEC 62548). */
export const STRING_FUSE_MIN = 1.5
export const STRING_FUSE_MAX = 2.4
const PV_PORT_TYPES: readonly ComponentType[] = ['mppt', 'pwm', 'gti', 'hyb', 'mi']

const K = (n: string, t: string) => n + ':' + t

/** Groups used for walking: a closed DC breaker conducts like any other inline device. */
function groupsOf(n: LabNode, open?: ReadonlySet<string>) {
  if (n.type === 'dcb') return open?.has(n.id) ? [] : [['i', 'o']]
  return conductiveGroups(n, open)
}

/** Union-find over terminals: wires plus internal bonds, skipping the bonds of `skip` nodes. */
export function terminalNets(nodes: readonly LabNode[], wires: readonly Wire[], skip: (n: LabNode) => boolean) {
  const par: Record<string, string> = {}
  const find = (k: string): string => {
    if (par[k] === undefined) par[k] = k
    while (par[k] !== k) {
      par[k] = par[par[k]]
      k = par[k]
    }
    return k
  }
  const uni = (a: string, b: string) => (par[find(a)] = find(b))
  wires.forEach((w) => uni(K(w.a.n, w.a.t), K(w.b.n, w.b.t)))
  nodes.forEach((n) => {
    if (!skip(n)) conductiveGroups(n).forEach(([first, ...rest]) => rest.forEach((t) => uni(K(n.id, first), K(n.id, t))))
  })
  return { find, same: (a: string, b: string) => find(a) === find(b) }
}

export interface Reach {
  /** Summed 1× Isc of PV modules reached (parallel sources add). */
  pvIsc: number
  /** Summed load current, A. */
  loadA: number
  /** Largest current any other source or sink can drive, A. */
  maxA: number
  pv: LabNode[]
  /** A PV input port (controller or inverter PV+/PV−) was reached. */
  pvPort: boolean
}

/** Design current behind a walk: PV gets the 1.25 factor, loads add, others bound. */
export const reachCurrent = (r: Reach) => Math.max(r.pvIsc * PV_CURRENT_FACTOR, r.loadA, r.maxA)

export interface InlineContext {
  nodes: readonly LabNode[]
  wires: readonly Wire[]
  nm: Record<string, LabNode>
  /** Same electrical net (validation's union-find). */
  same: (a: string, b: string) => boolean
  endCurrent: (n: LabNode, tid: string) => number
  add: (sev: Severity, rule: string, msg: string, fix: string, target: Issue['target']) => void
  /** Per-wire checks; ratings of wires touching pass-through devices are refined here. */
  wres: Record<string, { stages: { name: string; ok: boolean | null; note: string }[]; fail: { sev: Severity; rule: string; msg: string; fix: string } | null; I: number }>
  /** Every PV string the system found (controller, grid-tied, micro and hybrid inputs). */
  strings: LabNode[][]
  /** PV inputs with their strings, for the surge-protector check. */
  pvInputs: { node: LabNode; p: string; n: string; strings: LabNode[][] }[]
  /** Battery-side nominal DC voltage. */
  dcNom: number
  gnds: readonly LabNode[]
}

export function checkInlineDevices(ctx: InlineContext) {
  const { nodes, wires, nm, same, add } = ctx
  const adj = new Map<string, { k: string; w: string }[]>()
  wires.forEach((w) => {
    const a = K(w.a.n, w.a.t)
    const b = K(w.b.n, w.b.t)
    adj.set(a, [...(adj.get(a) ?? []), { k: b, w: w.id }])
    adj.set(b, [...(adj.get(b) ?? []), { k: a, w: w.id }])
  })

  /** Walk outward from `starts` through wires and conductors; never through `block` itself or `skipWire`. */
  const reach = (starts: string[], block?: string, skipWire?: string): Reach => {
    const r: Reach = { pvIsc: 0, loadA: 0, maxA: 0, pv: [], pvPort: false }
    const seen = new Set(starts)
    const counted = new Set<string>()
    const queue = [...starts]
    while (queue.length) {
      const k = queue.shift()!
      const [nid, tid] = k.split(':')
      const n = nm[nid]
      if (!n) continue
      const next: string[] = []
      if (nid !== block) {
        groupsOf(n).forEach((g) => g.includes(tid) && g.forEach((t) => next.push(K(nid, t))))
        if (!CONDUCTORS.has(n.type)) {
          if (PV_PORT_TYPES.includes(n.type) && (tid === 'pvp' || tid === 'pvn')) r.pvPort = true
          const isPe = CATALOG[n.type].L.concat(CATALOG[n.type].R).find((x) => x[0] === tid)?.[2] === 'pe'
          if (!isPe && !counted.has(nid)) {
            counted.add(nid)
            const a = ctx.endCurrent(n, tid) || 0
            if (isPv(n)) {
              r.pv.push(n)
              r.pvIsc += a
            } else if (LOAD_TYPES.includes(n.type) || n.type === 'mi') r.loadA += a
            else r.maxA = Math.max(r.maxA, a)
          }
        }
      }
      ;(adj.get(k) ?? []).forEach((e) => e.w !== skipWire && next.push(e.k))
      next.forEach((x) => {
        if (!seen.has(x)) {
          seen.add(x)
          queue.push(x)
        }
      })
    }
    return r
  }

  /** Terminals of a device on one side (L or R) that carry current through it, per pole. */
  const poles = (n: LabNode) => {
    const def = CATALOG[n.type]
    const left = new Set(def.L.map((t) => t[0]))
    const groups = n.type === 'dcb' ? [['i', 'o']] : [...(def.bus ?? []), ...(def.sw ?? [])]
    return groups.map((g) => ({ L: g.filter((t) => left.has(t)), R: g.filter((t) => !left.has(t)) }))
  }
  /** Current the device carries: per pole, the smaller of what each side can drive; worst pole. */
  const through = (n: LabNode) => {
    let worst = 0
    for (const p of poles(n)) {
      const side = (terms: string[]) => terms.reduce((a, t) => a + reachCurrent(reach([K(n.id, t)], n.id)), 0)
      const vals = [side(p.L), side(p.R)].filter((v) => v > 0)
      if (vals.length) worst = Math.max(worst, Math.min(...vals))
    }
    return worst
  }
  /** Circuit voltage seen by a DC device: the PV string Voc when it is on the array side, else the battery. */
  const dcVolts = (n: LabNode) => {
    const all = CATALOG[n.type].L.concat(CATALOG[n.type].R).filter((t) => t[2] !== 'pe')
    const r = all.map((t) => reach([K(n.id, t[0])], n.id))
    const pv = new Set(r.flatMap((x) => x.pv))
    if (pv.size) {
      const strings = ctx.strings.filter((s) => s.some((m) => pv.has(m)))
      return strings.length ? Math.max(...strings.map((s) => s.reduce((a, m) => a + m.specs.voc, 0))) : Math.max(...[...pv].map((m) => m.specs.voc))
    }
    return r.some((x) => x.pvPort) ? 0 : ctx.dcNom
  }
  const name = (n: LabNode) => CATALOG[n.type].name

  // ---- Wires that end on a pass-through device: their current comes from what is behind it.
  wires.forEach((w) => {
    const r = ctx.wres[w.id]
    const na = nm[w.a.n]
    const nb = nm[w.b.n]
    if (!r || !na || !nb || (!PASS_TYPES.includes(na.type) && !PASS_TYPES.includes(nb.type))) return
    if (r.fail && r.fail.rule !== 'RAT-004') return
    const dirs = [reachCurrent(reach([K(w.a.n, w.a.t)], undefined, w.id)), reachCurrent(reach([K(w.b.n, w.b.t)], undefined, w.id))].filter((v) => v > 0)
    const I = dirs.length ? Math.min(...dirs) : 0
    const amp = AMPACITY[w.gauge]
    r.I = I
    if (I > amp) {
      const need = Object.keys(AMPACITY).find((g) => AMPACITY[g] >= I) ?? '50+'
      const msg = `Potentially undersized conductor: ${w.gauge} mm² is rated ${amp} A, but this circuit can carry ${I.toFixed(0)} A.`
      r.fail = { sev: 'warning', rule: 'RAT-004', msg, fix: `Select a conductor of at least ${need} mm².` }
      r.stages[3] = { name: 'Ratings', ok: false, note: msg }
    } else {
      r.fail = null
      r.stages[3] = { name: 'Ratings', ok: true, note: I ? `${I.toFixed(1)} A expected. ${w.gauge} mm² is rated ${amp} A.` : 'No load current on this conductor.' }
    }
  })

  for (const n of nodes) {
    const s = n.specs
    // Open switches break the circuit on purpose; say so once.
    if (SWITCHED.includes(n.type) && s[SWITCH_SPEC] === 0)
      add('info', 'INF-010', `${name(n)} is open, so the circuit through it is switched off.`, 'Close the switch in the inspector when the circuit should be live.', { node: n.id })

    // Overcurrent devices: rating against the current the circuit can carry.
    if (PROTECTIVE.includes(n.type)) {
      const I = through(n)
      if (I > s.ratedI)
        add('warning', 'PRT-010', `The ${name(n)} is rated ${s.ratedI} A, but the circuit it protects can carry about ${I.toFixed(0)} A, so it will open in normal use.`, `Select a ${n.type === 'fuse' ? 'fuse' : 'breaker'} rated at least ${Math.ceil(I)} A, within the cable’s ampacity.`, { node: n.id })
    } else if (PASS_TYPES.includes(n.type) && s.ratedI) {
      // Combiners, connectors, isolators, meters, RCCBs and busbars: current rating.
      const I = n.type === 'dbus' ? Math.max(0, ...['p1', 'p2', 'p3', 'p4'].map((t) => reachCurrent(reach([K(n.id, t)], n.id)))) : through(n)
      if (I > s.ratedI)
        add('warning', 'RAT-020', `The ${name(n)} is rated ${s.ratedI} A, but about ${I.toFixed(0)} A can flow through it.`, 'Select a device with a higher current rating, or split the circuit.', { node: n.id })
    }

    // DC voltage ratings.
    if (DC_VRATED.includes(n.type) && s.maxV) {
      const V = dcVolts(n)
      if (V > s.maxV)
        add('warning', 'PRT-011', `The ${name(n)} is rated for ${s.maxV} V DC, below the ${V.toFixed(V < 100 ? 1 : 0)} V of the circuit it is in.`, 'Select a device rated for at least the circuit voltage (for PV, the string Voc).', { node: n.id })
    }

    // Combiner string fuses: between 1.5× and 2.4× the module Isc.
    if (n.type === 'cbx') {
      const isc = Math.max(0, ...['p1', 'p2', 'p3'].map((t) => Math.max(0, ...reach([K(n.id, t)], n.id).pv.map((m) => m.specs.isc))))
      if (isc > 0 && (s.fuseA < STRING_FUSE_MIN * isc || s.fuseA > STRING_FUSE_MAX * isc))
        add('warning', 'PRT-013', `The ${s.fuseA} A string fuses are outside ${STRING_FUSE_MIN}–${STRING_FUSE_MAX} × the module Isc (${isc} A), so they would ${s.fuseA < STRING_FUSE_MIN * isc ? 'blow in normal sun' : 'not protect the modules from reverse current'}.`, `Use string fuses between ${Math.ceil(STRING_FUSE_MIN * isc)} A and ${Math.floor(STRING_FUSE_MAX * isc)} A (and no more than the module’s maximum series fuse rating).`, { node: n.id })
    }

    // Surge protectors must have a path to earth.
    if (SPD_TYPES.includes(n.type) && !ctx.gnds.some((g) => same(K(g.id, 'pe'), K(n.id, 'pe'))))
      add('warning', 'GND-010', `The ${name(n)} PE terminal is not connected to earth, so it cannot divert a surge.`, 'Run a short PE conductor from the SPD to the earth bar or grounding rod.', { node: n.id })
  }

  // A DC SPD belongs across the PV input of every controller or string inverter.
  const dspds = nodes.filter((n) => n.type === 'dspd')
  for (const inp of ctx.pvInputs) {
    if (!inp.strings.length) continue
    if (!dspds.some((d) => same(K(d.id, 'p'), K(inp.node.id, inp.p)) && same(K(d.id, 'n'), K(inp.node.id, inp.n))))
      add('info', 'PRT-012', `No DC surge protective device across the PV input of the ${name(inp.node)}.`, 'Add a DC SPD across PV+ and PV− near the input and connect its PE terminal to earth.', { node: inp.node.id })
  }
}

/**
 * Inline devices a run-time fault holds open (blown fuse, tripped AC breaker). simulation.ts
 * re-validates with these open so everything downstream loses supply.
 */
export const OPENING_FAULTS = ['fuse-blown', 'ac-breaker-trip'] as const
