/**
 * AC-side power flow (PRD P2: grid-tied, hybrid and generator integration).
 *
 * The AC wiring is split into islands: base nets joined through net meters (always) and through
 * transfer switches (to whichever side is live). Each island is formed by at most one source:
 *   - hybrid inverter load port: PV, battery and grid/generator input, self-consumption first;
 *   - off-grid inverter: battery only;
 *   - utility grid: imports what loads need, absorbs grid-tied inverter export;
 *   - generator: supplies loads up to its rating.
 * Grid-tied inverters only produce when their island has a grid (or hybrid) reference
 * (anti-islanding). Educational model; it ignores reactive power, frequency and phase.
 */
import { faultOn, type Fault } from './faults'
import { scheduledOn } from './schedule'
import { loadOrderForShedding, loadPriority } from './loads'
import type { LabNode } from './types'
import type { ValidationResult } from './validation'

export const INVERTER_STANDBY_W = 18
export const HYBRID_STANDBY_W = 25
/** Short-term overload an inverter carries (×continuous rating) before its thermal protection acts. */
export const OVERLOAD_LIMIT = 1.25

export interface DcState {
  /** Battery voltage (0 when the bank is disconnected). */
  vbat: number
  bmsOff: boolean
  /** Off-grid inverter DC supply open. */
  dcOff: boolean
  soc: number
  lvd: boolean
  /** Irradiance-driven PV power for a set of strings, before conversion. */
  pvPower: (strings: LabNode[][]) => number
  /** Battery-low load shedding: 0 none, 1 priority-3 loads, 2 priority-2 and 3 loads. */
  shedLevel?: number
  /** Loads held off because their startup surge exceeded the inverter's surge rating. */
  surgeBlocked?: readonly string[]
  /** DC power the off-grid inverter may draw: bank discharge limit plus charge-controller output, W. */
  dischargeW?: number
  /** Off-grid inverter output tripped by its thermal protection. */
  invTripped?: boolean
  /** Hybrid battery reserve when islanded (chemistry minimum SOC), %. */
  minSoc?: number
  /** Battery bank maximum charge current, A. */
  bankMaxC?: number
}

export type ShedReason = 'battery' | 'overload'

export interface AcResult {
  onLoads: LabNode[]
  rcdOff: LabNode[]
  /** Loads switched off because their island has no live source. */
  unpowered: LabNode[]
  /** Outlets with voltage at their sockets. */
  outletsLive: string[]
  /** Inline AC devices (v.sys.ac.inline) with voltage on their supply side. */
  liveDevices: string[]
  pload: number
  /** Off-grid inverter */
  invOn: boolean
  pinv: number
  overload: boolean
  derated: boolean
  /** Hybrid: power into (+) or out of (−) the battery, W. */
  hybBattery: number
  hybPv: number
  hybMode: 'off' | 'grid' | 'battery' | 'generator' | 'none'
  hybOverload: boolean
  /** Utility grid: + import, − export, W. */
  pgrid: number
  /** Generator output, W. */
  pgen: number
  genOverload: boolean
  /** Grid-tied inverter AC output, W. */
  gtiAc: number
  /** Grid-tied inverters held off by anti-islanding. */
  gtiIslanded: boolean
  /** Hybrid PV curtailed because the battery is full and export is limited. */
  hybCurtailed: number
  /** Position of each transfer switch. */
  atsSide: Record<string, 'main' | 'backup' | 'none'>
  /** Grids currently in outage. */
  gridOut: string[]
  /** Loads switched off by load shedding (lowest priority first). */
  shed: { id: string; reason: ShedReason }[]
  /** Loads held off by a surge overload at start-up. */
  blocked: LabNode[]
  /** BMS over-current: the inverter would draw more than the bank's discharge limit, so its output is off. */
  bmsOvercurrent: boolean
  /** Off-grid inverter running above its continuous rating (within OVERLOAD_LIMIT). */
  invStrained: boolean
  /** Which source supplies each running load. */
  sourceOf: Record<string, 'inv' | 'hyb' | 'grid' | 'gen'>
}

class UF {
  par: Record<string, string> = {}
  find(k: string): string {
    if (this.par[k] === undefined) this.par[k] = k
    while (this.par[k] !== k) {
      this.par[k] = this.par[this.par[k]]
      k = this.par[k]
    }
    return k
  }
  uni(a: string, b: string) {
    this.par[this.find(a)] = this.find(b)
  }
}

export interface Islands {
  uf: UF
  net: (n: string, t: string) => string
  live: (netId: string) => boolean
  gridLive: (g: LabNode) => boolean
  genLive: (g: LabNode) => boolean
  atsSide: Record<string, 'main' | 'backup' | 'none'>
}

/**
 * Build the AC islands for the current state. `genOn` lists running generators.
 * `invAvail`/`hybAvail` say whether those inverters can form their island right now.
 */
export function buildIslands(v: ValidationResult, act: readonly Fault[], genOn: readonly string[], invAvail: boolean, hybFormsIsland: (gridSideLive: boolean) => boolean): Islands {
  const ac = v.sys.ac
  const uf = new UF()
  const net = (n: string, t: string) => uf.find(ac.netOf(n, t))
  ac.meters.forEach((m) => uf.uni(ac.netOf(m.id, 'gl'), ac.netOf(m.id, 'l')))
  const gridLive = (g: LabNode) => !faultOn(act, g.id, 'grid-outage')
  const genLive = (g: LabNode) => genOn.includes(g.id) && !faultOn(act, g.id, 'gen-fail')

  const sources = (): string[] => {
    const out: string[] = []
    ac.grids.filter(gridLive).forEach((g) => out.push(ac.netOf(g.id, 'l')))
    ac.gens.filter(genLive).forEach((g) => out.push(ac.netOf(g.id, 'l')))
    if (invAvail && v.sys.inv) out.push(ac.netOf(v.sys.inv.id, 'l'))
    return out
  }
  const liveSet = (extra: string[] = []) => new Set([...sources(), ...extra].map((n) => uf.find(n)))
  // Transfer switches take the main side when it is live, otherwise the backup side.
  // Two passes let a switch downstream of another settle.
  const atsSide: Record<string, 'main' | 'backup' | 'none'> = {}
  for (let pass = 0; pass < 2; pass++) {
    const hybGridSide = ac.hyb ? liveSet().has(net(ac.hyb.node.id, 'gl')) : false
    const hybNet = ac.hyb && hybFormsIsland(hybGridSide) ? [ac.netOf(ac.hyb.node.id, 'l')] : []
    const ls = liveSet(hybNet)
    ac.atss.forEach((a) => {
      const out = net(a.id, 'l')
      if (atsSide[a.id] && atsSide[a.id] !== 'none') return
      if (ls.has(net(a.id, 'ml'))) {
        uf.uni(out, ac.netOf(a.id, 'ml'))
        atsSide[a.id] = 'main'
      } else if (ls.has(net(a.id, 'bl'))) {
        uf.uni(out, ac.netOf(a.id, 'bl'))
        atsSide[a.id] = 'backup'
      } else atsSide[a.id] = 'none'
    })
  }
  const hybGridSide = ac.hyb ? liveSet().has(net(ac.hyb.node.id, 'gl')) : false
  const finalLive = liveSet(ac.hyb && hybFormsIsland(hybGridSide) ? [ac.netOf(ac.hyb.node.id, 'l')] : [])
  return { uf, net, live: (n) => finalLive.has(uf.find(n)), gridLive, genLive, atsSide }
}

export function solveAc(v: ValidationResult, act: readonly Fault[], h: number, dc: DcState, rcdTripped: readonly string[], genOn: readonly string[]): AcResult {
  const s = v.sys
  const ac = s.ac
  const res: AcResult = {
    onLoads: [],
    rcdOff: [],
    unpowered: [],
    outletsLive: [],
    liveDevices: [],
    pload: 0,
    invOn: false,
    pinv: 0,
    overload: false,
    derated: false,
    hybBattery: 0,
    hybPv: 0,
    hybMode: ac.hyb ? 'off' : 'none',
    hybOverload: false,
    pgrid: 0,
    pgen: 0,
    genOverload: false,
    gtiAc: 0,
    gtiIslanded: false,
    hybCurtailed: 0,
    atsSide: {},
    gridOut: [],
    shed: [],
    blocked: [],
    bmsOvercurrent: false,
    invStrained: false,
    sourceOf: {},
  }
  const invAvail = !!(s.invOk && s.inv && !dc.lvd && !dc.dcOff)
  const hyb = ac.hyb
  const hybBatteryOk = !!(hyb?.bank && !dc.bmsOff && dc.vbat > 0)
  const hybFormsIsland = (gridSide: boolean) => !!(s.hybOk && hyb && (gridSide || (hybBatteryOk && !dc.lvd)))
  const isl = buildIslands(v, act, genOn, invAvail, hybFormsIsland)
  const { net, live } = isl
  res.atsSide = isl.atsSide
  res.gridOut = ac.grids.filter((g) => !isl.gridLive(g)).map((g) => g.id)

  const tripped = new Set(rcdTripped)
  const loads = s.acSupplied
  const scheduled = loads.filter((l) => scheduledOn(l, h))
  res.rcdOff = scheduled.filter((l) => tripped.has(s.boardOf[l.id]))
  const blocked = new Set(dc.surgeBlocked ?? [])
  res.blocked = scheduled.filter((l) => blocked.has(l.id) && !tripped.has(s.boardOf[l.id]))
  const candidates = scheduled.filter((l) => !tripped.has(s.boardOf[l.id]) && !blocked.has(l.id))
  const loadsIn = (group: string) => candidates.filter((l) => net(l.id, 'l') === group)

  const gridIn = (group: string) => ac.grids.find((g) => isl.gridLive(g) && net(g.id, 'l') === group)
  const genIn = (group: string) => ac.gens.find((g) => isl.genLive(g) && net(g.id, 'l') === group)

  // Grid-tied inverters (anti-islanding: need a grid or a hybrid-formed island).
  const gtiOut = new Map<string, number>()
  for (const { node, strings } of ac.gtis) {
    const g = net(node.id, 'l')
    const reference = gridIn(g) || (hyb && hybFormsIsland(live(net(hyb.node.id, 'gl'))) && net(hyb.node.id, 'l') === g)
    if (!reference) {
      if (dc.pvPower(strings) > 0) res.gtiIslanded = true
      continue
    }
    const p = Math.min(node.specs.ratedP, (dc.pvPower(strings) * node.specs.eff) / 100)
    gtiOut.set(g, (gtiOut.get(g) ?? 0) + p)
    res.gtiAc += p
  }

  const handled = new Set<string>()
  const powered: LabNode[] = []

  // Hybrid island.
  if (hyb && s.hybOk) {
    const g = net(hyb.node.id, 'l')
    handled.add(g)
    const gridSide = net(hyb.node.id, 'gl')
    const gridSrc = gridIn(gridSide)
    const genSrc = genIn(gridSide)
    const sp = hyb.node.specs
    const eff = sp.eff / 100
    if (hybFormsIsland(!!(gridSrc || genSrc))) {
      const external = !!(gridSrc || genSrc)
      // Islanded, the hybrid sheds non-essential loads before it overloads.
      const group = external ? loadsIn(g) : shedTo(loadsIn(g), sp.ratedP, 'overload', res)
      const D = group.reduce((a, l) => a + l.specs.p, 0)
      const pv = dc.pvPower(hyb.strings) * eff
      res.hybPv = pv
      const acPv = pv + (gtiOut.get(g) ?? 0)
      group.forEach((l) => (res.sourceOf[l.id] = external ? (gridSrc ? 'grid' : 'gen') : 'hyb'))
      if (!external && D > sp.ratedP) {
        res.hybOverload = true
      } else {
        powered.push(...group)
        res.pload += D
        const standby = HYBRID_STANDBY_W
        let net = acPv - D - standby
        const chargeLimit = hybBatteryOk && dc.soc < 100 ? Math.min(sp.maxI, dc.bankMaxC ?? Infinity) * dc.vbat : 0
        if (net >= 0) {
          const charge = Math.min(net, chargeLimit)
          res.hybBattery += charge
          net -= charge
          const exportable = gridSrc ? Math.min(net, sp.exportLimit) : 0
          res.pgrid -= exportable
          res.hybCurtailed = net - exportable
          res.hybMode = gridSrc ? 'grid' : 'battery'
        } else {
          let deficit = -net
          const reserve = external ? sp.reserveSoc : (dc.minSoc ?? 10)
          if (hybBatteryOk && dc.soc > reserve && !dc.lvd) {
            const discharge = Math.min(deficit, (hyb.bank?.maxD ?? 0) * dc.vbat * eff)
            res.hybBattery -= discharge / eff
            deficit -= discharge
          }
          if (deficit > 0 && gridSrc) {
            res.pgrid += deficit
            res.hybMode = 'grid'
          } else if (deficit > 0 && genSrc) {
            // The generator also tops up the battery while it runs.
            const top = Math.min(genSrc.specs.ratedP - deficit, chargeLimit)
            res.pgen += deficit + Math.max(0, top)
            res.hybBattery += Math.max(0, top) * eff
            res.hybMode = 'generator'
          } else if (deficit > 1) {
            // Islanded with an empty battery: the hybrid shuts its output down.
            powered.splice(powered.length - group.length, group.length)
            res.pload -= D
            res.hybMode = 'off'
          } else res.hybMode = gridSrc ? 'grid' : 'battery'
        }
      }
    }
  }

  // Off-grid inverter island.
  if (invAvail && s.inv) {
    const g = net(s.inv.id, 'l')
    if (!handled.has(g)) {
      handled.add(g)
      res.derated = !!faultOn(act, s.inv.id, 'inverter-overtemp')
      const capacity = dc.invTripped ? 0 : s.inv.specs.ratedP * (res.derated ? 0.5 : 1)
      const eff = s.inv.specs.eff / 100
      // AC power the bank can back within its discharge limit (plus PV through the controller).
      const dcCap = dc.dischargeW === undefined ? Infinity : Math.max(0, (dc.dischargeW - INVERTER_STANDBY_W) * eff)
      // Battery low: shed non-essential loads first (priority 3, then 2).
      let group = dc.invTripped ? [] : loadsIn(g)
      const level = dc.shedLevel ?? 0
      if (level > 0) {
        const keep = group.filter((l) => loadPriority(l) < 4 - level)
        group.filter((l) => !keep.includes(l)).forEach((l) => res.shed.push({ id: l.id, reason: 'battery' }))
        group = keep
      }
      group = shedTo(group, Math.min(capacity, dcCap), 'overload', res)
      const D = group.reduce((a, l) => a + l.specs.p, 0)
      // An over-temperature (derated) inverter has no overload headroom.
      const margin = res.derated ? 1 : OVERLOAD_LIMIT
      if (D > dcCap) res.bmsOvercurrent = true
      else if (D > capacity * margin) res.overload = true
      else if (!dc.invTripped) {
        res.invOn = true
        res.invStrained = D > capacity
        powered.push(...group)
        group.forEach((l) => (res.sourceOf[l.id] = 'inv'))
        res.pload += D
        res.pinv = D / eff + INVERTER_STANDBY_W
      }
    }
  }

  // Grid and generator islands (grid-tied systems, generator-only circuits).
  const groups = new Set(candidates.map((l) => net(l.id, 'l')))
  gtiOut.forEach((_, g) => groups.add(g))
  for (const g of groups) {
    if (handled.has(g)) continue
    handled.add(g)
    const group = loadsIn(g)
    const D = group.reduce((a, l) => a + l.specs.p, 0)
    const gti = gtiOut.get(g) ?? 0
    const grid = gridIn(g)
    const gen = genIn(g)
    if (grid) {
      powered.push(...group)
      group.forEach((l) => (res.sourceOf[l.id] = 'grid'))
      res.pload += D
      res.pgrid += D - gti
    } else if (gen) {
      if (D > gen.specs.ratedP) res.genOverload = true
      else {
        powered.push(...group)
        group.forEach((l) => (res.sourceOf[l.id] = 'gen'))
        res.pload += D
        res.pgen += D
      }
    }
  }

  res.onLoads = powered
  const shedIds = new Set(res.shed.map((x) => x.id))
  res.unpowered = candidates.filter((l) => !powered.includes(l) && !shedIds.has(l.id))
  // An outlet is live when its island has a source, its board's RCD is closed and the source has not shut down.
  res.outletsLive = s.outletsSupplied.filter((id) => {
    if (!live(net(id, 'l')) || tripped.has(s.outletBoard[id])) return false
    const plugged = candidates.filter((l) => s.outletsOf[l.id]?.includes(id))
    return !plugged.length || plugged.some((l) => powered.includes(l))
  })
  // Inline AC devices (breakers, RCCBs, disconnects, meters, SPDs) with voltage on their supply side.
  res.liveDevices = ac.inline
    .filter((d) => {
      const g = net(d.id, 'l')
      if (!live(g)) return false
      const group = candidates.filter((l) => net(l.id, 'l') === g)
      return !group.length || group.some((l) => powered.includes(l))
    })
    .map((d) => d.id)
  return res
}

/**
 * Load shedding: drop priority-3, then priority-2 loads (largest first) until the group fits
 * `limit` W. Essential (priority 1) loads are never shed. Records what it sheds in `res.shed`.
 */
function shedTo(group: LabNode[], limit: number, reason: ShedReason, res: AcResult) {
  let D = group.reduce((a, l) => a + l.specs.p, 0)
  if (D <= limit) return group
  const keep = new Set(group)
  for (const l of loadOrderForShedding(group)) {
    if (D <= limit) break
    keep.delete(l)
    D -= l.specs.p
    res.shed.push({ id: l.id, reason })
  }
  return group.filter((l) => keep.has(l))
}

/**
 * Which generators should run (auto-start control). A generator runs when it backs a transfer
 * switch whose main side is dead, when it feeds a hybrid's grid input with no grid present and the
 * battery is low (with hysteresis), or when it is the only source for scheduled loads.
 */
export function generatorDemand(v: ValidationResult, act: readonly Fault[], h: number, soc: number, running: readonly string[], invAvail: boolean, hybFormsIsland: (gridSide: boolean) => boolean): string[] {
  const ac = v.sys.ac
  if (!ac.gens.length) return []
  // Liveness without any generator running.
  const isl = buildIslands(v, act, [], invAvail, hybFormsIsland)
  const want: string[] = []
  for (const gen of ac.gens) {
    const gNet = isl.net(gen.id, 'l')
    const backsAts = ac.atss.find((a) => isl.uf.find(ac.netOf(a.id, 'bl')) === gNet)
    const hyb = ac.hyb
    const feedsHybrid = hyb && (isl.net(hyb.node.id, 'gl') === gNet || (backsAts && isl.net(hyb.node.id, 'gl') === isl.uf.find(ac.netOf(backsAts.id, 'l'))))
    if (feedsHybrid) {
      const gridPresent = ac.grids.some((g) => isl.gridLive(g) && isl.live(isl.net(hyb.node.id, 'gl')))
      const wasOn = running.includes(gen.id)
      if (!gridPresent && (soc < gen.specs.startSoc || (wasOn && soc < gen.specs.stopSoc))) want.push(gen.id)
      continue
    }
    if (backsAts) {
      if (!isl.live(ac.netOf(backsAts.id, 'ml'))) want.push(gen.id)
      continue
    }
    if (v.sys.acSupplied.some((l) => isl.net(l.id, 'l') === gNet && scheduledOn(l, h))) want.push(gen.id)
  }
  return want
}

/** Educational fuel model: litres per hour for a generator at a given load. */
export function fuelRate(gen: LabNode, load: number) {
  const frac = Math.min(1, load / gen.specs.ratedP)
  return (gen.specs.ratedP / 1000) * (0.08 + 0.25 * frac)
}
