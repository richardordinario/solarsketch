import { AMPACITY, BATTERY_TYPES, CATALOG, COPPER_RESISTIVITY, DEFAULT_WIRE_LENGTH, LOAD_TYPES, PV_TYPES, VOLTAGE_DROP_LIMIT, conductiveGroups, isBattery, isPv } from './catalog'
import { bankOcv, bankSocAt, cellCount, chemistryOf, incompatibleChemistries } from './battery-chem'
import { DESIGN_MIN_TEMP, coldVoc } from './pv-model'
import { STAGE_NAMES, stageOf } from './rules'
import { terminal, terminalName } from './geometry'
import { AC_INLINE, checkInlineDevices, terminalNets } from './inline'
import type { ComponentType, Issue, LabNode, Severity, TerminalType, Wire } from './types'

export type NodeMap = Record<string, LabNode>

export interface StageResult {
  name: string
  /** null = not run because an earlier stage failed. */
  ok: boolean | null
  note: string
}

export interface WireFailure {
  sev: Severity
  rule: string
  msg: string
  fix: string
}

export interface VoltageDrop {
  /** Circuit nominal voltage used for the percentage, V. */
  vNom: number
  /** Round-trip drop at the expected current, V. */
  volts: number
  pct: number
  length: number
}

export interface WireCheck {
  stages: StageResult[]
  fail: WireFailure | null
  /** Expected current on the conductor, A. */
  I: number
  /** Filled in by validate(), which knows the circuit voltage. */
  drop?: VoltageDrop
}

/** Series strings of batteries connected in parallel between two nets. */
export interface BatteryBank {
  strings: LabNode[][]
  members: LabNode[]
  /** Nominal bank voltage (one string), V. */
  nomV: number
  /** Capacity, Ah (sum over parallel strings of the weakest battery in each). */
  ah: number
  /** Max charge / discharge current of the bank, A. */
  maxC: number
  maxD: number
  kwh: number
}

export interface SystemModel {
  strings: LabNode[][]
  ccOk: boolean
  cc: LabNode | null
  /** Bank on the charge controller's battery terminals. */
  bank: BatteryBank | null
  inv: LabNode | null
  /** Bank feeding the inverter DC input. */
  invBank: BatteryBank | null
  /** DC breaker between the bank and the inverter, if any. */
  invBreaker: LabNode | null
  /** AC distribution board each load is wired to (its RCD protects that load). */
  boardOf: Record<string, string>
  /** Outlets each load is plugged into, nearest first (a load can be fed through chained outlets). */
  outletsOf: Record<string, string[]>
  /** Outlets whose supply side reaches an AC source. */
  outletsSupplied: string[]
  /** Distribution board whose circuit feeds each outlet. */
  outletBoard: Record<string, string>
  supplied: LabNode[]
  /** Loads reachable from any AC source (inverter, hybrid, grid or generator), through meters and transfer switches. */
  acSupplied: LabNode[]
  /** Grid, hybrid and generator topology (P2). */
  ac: AcModel
  ok: boolean
  invOk: boolean
  /** Hybrid inverter usable (present with a battery bank and no critical findings). */
  hybOk: boolean
}

export interface HybridSystem {
  node: LabNode
  strings: LabNode[][]
  bank: BatteryBank | null
}

export interface AcModel {
  /** Base electrical net of a terminal (wires and busbars only). */
  netOf: (nodeId: string, term: string) => string
  grids: LabNode[]
  gens: LabNode[]
  atss: LabNode[]
  meters: LabNode[]
  /** Grid-tied string inverters and microinverters. */
  gtis: { node: LabNode; strings: LabNode[][] }[]
  hyb: HybridSystem | null
  /** AC breakers, RCCBs, disconnects, energy meters and SPDs (AcResult.liveDevices reports their supply). */
  inline: LabNode[]
}

/** Result of one of the six validation stages over the whole project (CLAUDE.md rule 5). */
export interface StageSummary {
  stage: number
  name: string
  status: 'pass' | 'warning' | 'fail'
  /** Findings in this stage. */
  count: number
}

export interface ValidationResult {
  /** Findings ordered by severity, then validation stage (deterministic). */
  issues: Issue[]
  /** The six stages in order: terminal, AC/DC domain, polarity, ratings, topology, protection. */
  stages: StageSummary[]
  wres: Record<string, WireCheck>
  sys: SystemModel
  /** The project the result was computed from (meters and run-time faults re-use it). */
  nodes: LabNode[]
  wires: Wire[]
}

export function nodeMap(nodes: LabNode[]): NodeMap {
  const nm: NodeMap = {}
  nodes.forEach((n) => (nm[n.id] = n))
  return nm
}

/** Worst-case current a terminal can drive into a conductor. */
function endCurrent(nd: LabNode, tid: string) {
  const s = nd.specs
  if (tid === 'pe' && (isPv(nd) || isBattery(nd))) return 0
  if (isPv(nd)) return s.isc
  if (isBattery(nd)) return s.maxD
  switch (nd.type) {
    case 'mppt':
    case 'pwm':
      return tid === 'bp' || tid === 'bn' ? s.maxI : 0
    case 'dcb':
      return s.ratedI
    case 'inv':
      return tid === 'dp' || tid === 'dn' ? s.ratedP / ((s.nomV * s.eff) / 100) : tid === 'pe' ? 0 : s.ratedP / s.acV
    case 'acdb':
    case 'outlet':
      return tid === 'pe' ? 0 : s.ratedI
    case 'gnd':
      return 0
    case 'gti':
      return tid === 'pvp' || tid === 'pvn' ? s.maxPvI : tid === 'pe' ? 0 : s.ratedP / s.acV
    case 'hyb':
      if (tid === 'pvp' || tid === 'pvn') return s.maxPvI
      if (tid === 'bp' || tid === 'bn') return Math.max(s.maxI, s.ratedP / ((s.nomV * s.eff) / 100))
      return tid === 'pe' ? 0 : s.ratedP / s.acV
    case 'grid':
      return tid === 'pe' ? 0 : s.serviceA
    case 'gen':
      return tid === 'pe' ? 0 : s.ratedP / s.acV
    case 'nm':
    case 'ats':
      return s.ratedI
    // Overcurrent devices: the conductor after them must carry their rating.
    case 'fuse':
    case 'mcb':
    case 'mccb':
      return s.ratedI
    case 'mi':
      return tid === 'pvp' || tid === 'pvn' ? s.maxPvI : tid === 'pe' ? 0 : s.ratedP / s.acV
    // Pass-through devices, surge protectors and earth bars set no current of their own
    // (validate() refines wires on pass-through devices from what is behind them).
    case 'mc4':
    case 'ybr':
    case 'cbx':
    case 'iso':
    case 'dspd':
    case 'rccb':
    case 'aspd':
    case 'acsw':
    case 'dbus':
    case 'pebar':
    case 'dcm':
    case 'acm':
      return 0
    default:
      return s.p / 230
  }
}

const isDC = (x: TerminalType) => x === 'dc+' || x === 'dc-' || x === 'dc'
const isAC = (x: TerminalType) => x === 'ac-l' || x === 'ac-n'

export const wireLength = (w: Wire) => w.length ?? DEFAULT_WIRE_LENGTH

/** Round-trip voltage drop: the return conductor is assumed to match this one. */
export function voltageDrop(w: Wire, I: number, vNom: number): VoltageDrop {
  const length = wireLength(w)
  const volts = (2 * length * I * COPPER_RESISTIVITY) / parseFloat(w.gauge)
  return { vNom, volts, pct: vNom > 0 ? (volts / vNom) * 100 : 0, length }
}

/** Per-wire stages 1–4: terminal, AC/DC domain, polarity, ratings (ampacity). */
export function checkWire(w: Wire, nm: NodeMap): WireCheck | null {
  const na = nm[w.a.n]
  const nb = nm[w.b.n]
  if (!na || !nb) return null
  const ta = terminal(na, w.a.t)
  const tb = terminal(nb, w.b.t)
  if (!ta || !tb) return null
  const A = ta.t
  const B = tb.t
  const nA = terminalName(na, w.a.t)
  const nB = terminalName(nb, w.b.t)
  const st: StageResult[] = ['Terminal', 'AC/DC domain', 'Polarity', 'Ratings'].map((name) => ({ name, ok: null, note: '' }))
  let fail: WireFailure | null = null
  const bad = (i: number, sev: Severity, rule: string, msg: string, fix: string) => {
    st[i].ok = false
    st[i].note = msg
    fail = { sev, rule, msg, fix }
  }

  if (na.id === nb.id) bad(0, 'critical', 'TRM-001', 'Both ends of this wire land on the same component. This bypasses it and can short its terminals.', 'Connect the terminal to a different component.')
  else if ((A === 'pe') !== (B === 'pe')) bad(0, 'critical', 'TRM-002', `Protective earth is connected to a current-carrying terminal (${nA} to ${nB}).`, 'Connect PE terminals only to other PE terminals or a grounding rod.')
  else {
    st[0].ok = true
    st[0].note = 'Terminal types are compatible.'
  }

  if (!fail) {
    if ((isDC(A) && isAC(B)) || (isAC(A) && isDC(B))) bad(1, 'critical', 'DOM-001', `${nA} is DC and ${nB} is AC. This connection violates the selected component's terminal constraints.`, 'DC circuits reach AC loads only through the inverter.')
    else {
      st[1].ok = true
      st[1].note = A === 'pe' ? 'Protective earth.' : isDC(A) || isDC(B) ? 'Both terminals are DC.' : 'Both terminals are AC.'
    }
  }

  if (!fail) {
    if ((A === 'dc+' && B === 'dc-') || (A === 'dc-' && B === 'dc+')) {
      // PV modules chain with PV modules and batteries with batteries (BAT-003 flags mixed chemistries).
      if ((isPv(na) && isPv(nb)) || (isBattery(na) && isBattery(nb))) {
        st[2].ok = true
        st[2].note = isPv(na) ? 'Series connection between modules (+ to −).' : 'Series connection between batteries (+ to −).'
      } else bad(2, 'critical', 'POL-001', `Reversed polarity: ${nA} is connected to ${nB}.`, 'Connect positive to positive and negative to negative.')
    } else if ((A === 'ac-l' && B === 'ac-n') || (A === 'ac-n' && B === 'ac-l')) bad(2, 'critical', 'POL-002', `Line is connected to neutral (${nA} to ${nB}). This is a short circuit.`, 'Connect L to L and N to N.')
    else {
      st[2].ok = true
      st[2].note = 'Polarity matches.'
    }
  }

  const cur = [endCurrent(na, w.a.t), endCurrent(nb, w.b.t)].filter((v) => v > 0)
  const I = cur.length ? Math.min(...cur) : 0
  const amp = AMPACITY[w.gauge]
  if (!fail) {
    if (I > amp) {
      const need = Object.keys(AMPACITY).find((g) => AMPACITY[g] >= I) ?? '50+'
      bad(3, 'warning', 'RAT-004', `Potentially undersized conductor: ${w.gauge} mm² is rated ${amp} A, but this circuit can carry ${I.toFixed(0)} A.`, `Select a conductor of at least ${need} mm².`)
    } else {
      st[3].ok = true
      st[3].note = I ? `${I.toFixed(1)} A expected. ${w.gauge} mm² is rated ${amp} A.` : 'No load current on this conductor.'
    }
  }
  return { stages: st, fail, I }
}

const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }

function bankOf(strings: LabNode[][]): BatteryBank | null {
  if (!strings.length) return null
  const members = strings.flat()
  const nomV = Math.max(...strings.map((s) => s.reduce((a, b) => a + b.specs.nomV, 0)))
  const per = (key: string) => strings.reduce((a, s) => a + Math.min(...s.map((b) => b.specs[key])), 0)
  const ah = per('ah')
  return { strings, members, nomV, ah, maxC: per('maxC'), maxD: per('maxD'), kwh: (nomV * ah) / 1000 }
}

/** Full-system validation: per-wire checks plus topology, ratings, protection and grounding. */
export function validate(nodes: LabNode[], wires: Wire[]): ValidationResult {
  const nm = nodeMap(nodes)
  const par: Record<string, string> = {}
  const find = (k: string) => {
    if (par[k] === undefined) par[k] = k
    while (par[k] !== k) {
      par[k] = par[par[k]]
      k = par[k]
    }
    return k
  }
  const uni = (a: string, b: string) => {
    par[find(a)] = find(b)
  }
  const K = (n: string, t: string) => n + ':' + t
  const same = (a: string, b: string) => find(a) === find(b)
  const issues: Issue[] = []
  const wres: Record<string, WireCheck> = {}
  const connected: Record<string, true> = {}
  const add = (sev: Severity, rule: string, msg: string, fix: string, target: Issue['target']) => issues.push({ sev, rule, msg, fix, target })

  wires.forEach((w) => {
    const r = checkWire(w, nm)
    if (!r) return
    wres[w.id] = r
    uni(K(w.a.n, w.a.t), K(w.b.n, w.b.t))
    connected[K(w.a.n, w.a.t)] = true
    connected[K(w.b.n, w.b.t)] = true
  })
  // Busbars, plus inline devices (connectors, fuses, closed switches) that conduct.
  nodes.forEach((n) => conductiveGroups(n).forEach((g) => g.slice(1).forEach((t) => uni(K(n.id, g[0]), K(n.id, t)))))

  const of = (t: readonly ComponentType[]) => nodes.filter((n) => t.includes(n.type))
  const pvs = of(PV_TYPES)
  const ccs = of(['mppt', 'pwm'])
  const bats = of(BATTERY_TYPES)
  const dcbs = of(['dcb'])
  const fuses = of(['fuse'])
  let fuseNets: ReturnType<typeof terminalNets> | undefined
  const invs = of(['inv'])
  const gnds = of(['gnd'])
  const loads = of(LOAD_TYPES)
  const dbs = of(['acdb'])
  const outlets = of(['outlet'])
  const sys: SystemModel = {
    strings: [],
    ccOk: false,
    cc: null,
    bank: null,
    inv: null,
    invBank: null,
    invBreaker: null,
    boardOf: {},
    outletsOf: {},
    outletsSupplied: [],
    outletBoard: {},
    supplied: [],
    acSupplied: [],
    ac: { netOf: (n, t) => find(K(n, t)), grids: [], gens: [], atss: [], meters: [], gtis: [], hyb: null, inline: of(AC_INLINE) },
    ok: false,
    invOk: false,
    hybOk: false,
  }

  /**
   * Series strings of `cands` (terminals p / n) from the net of `start` to the net of `end`.
   * Strings that never reach `end` are reported through `onOpen`.
   */
  const findStrings = (cands: LabNode[], start: string, end: string, onOpen: (last: LabNode) => void) => {
    const strings: LabNode[][] = []
    cands
      .filter((c) => same(K(c.id, 'p'), start))
      .forEach((s) => {
        let cur = s
        const seen = new Set([s.id])
        const chain = [s]
        for (let g = 0; g < 50; g++) {
          if (same(K(cur.id, 'n'), end)) {
            strings.push(chain)
            return
          }
          const nx = cands.find((p) => !seen.has(p.id) && same(K(p.id, 'p'), K(cur.id, 'n')))
          if (!nx) {
            onOpen(cur)
            return
          }
          seen.add(nx.id)
          chain.push(nx)
          cur = nx
        }
      })
    return strings
  }

  const checkBank = (bank: BatteryBank) => {
    const volts = new Set(bank.strings.map((s) => s.reduce((a, b) => a + b.specs.nomV, 0)))
    if (volts.size > 1)
      add('critical', 'BAT-001', `Parallel battery strings have different voltages (${[...volts].map((v) => `${v} V`).join(', ')}).`, 'Give every parallel string the same number of identical batteries.', { node: bank.members[0].id })
    const chems = [...new Map(bank.members.map((b) => [chemistryOf(b).id, chemistryOf(b)])).values()]
    const clash = chems.some((a) => chems.some((b) => incompatibleChemistries(a, b)))
    if (clash)
      add('critical', 'BAT-003', `This battery bank mixes chemistries (${chems.map((c) => c.label).join(', ')}). Each needs its own charge voltages and protection.`, 'Build each bank from one chemistry only, and set the chargers for that chemistry.', { node: bank.members[0].id })
    const kinds = new Set(bank.members.map((b) => `${b.type}/${b.specs.nomV}/${b.specs.ah}`))
    if (kinds.size > 1 && !clash) add('warning', 'BAT-002', 'This battery bank mixes batteries of different types, voltages or capacities.', 'Build each bank from identical batteries of the same age.', { node: bank.members[0].id })
  }
  /** Highest string Voc at the cold design temperature (0 when there are no strings). */
  const coldStringVoc = (strings: LabNode[][]) => (strings.length ? Math.max(...strings.map((ch) => ch.reduce((a, p) => a + coldVoc(p), 0))) : 0)
  const checkColdVoc = (owner: LabNode, strings: LabNode[][], vStc: number, label: string) => {
    const cold = coldStringVoc(strings)
    if (vStc <= owner.specs.maxPvV && cold > owner.specs.maxPvV)
      add('warning', 'RAT-012', `On a cold morning (${DESIGN_MIN_TEMP} °C) the string Voc rises to about ${cold.toFixed(1)} V, above the ${label}’s ${owner.specs.maxPvV} V input limit (${vStc.toFixed(1)} V at 25 °C).`, 'Use fewer modules in series so the cold-morning Voc stays below the input limit.', { node: owner.id })
  }
  /** Inverter DC input range (RAT-013) and low-voltage disconnect setting (BAT-004) for the bank's chemistry. */
  const checkInverterBattery = (iv: LabNode, bank: BatteryBank) => {
    const chem = chemistryOf(bank.members[0])
    const vCharge = cellCount(chem, bank.nomV) * chem.absorbV
    const vLow = bankOcv(chem, bank.nomV, chem.minSoc)
    const sp = iv.specs
    if (sp.maxDcV > 0 && vCharge > sp.maxDcV)
      add('warning', 'RAT-013', `While charging, the ${chem.label} bank reaches about ${vCharge.toFixed(1)} V, above the inverter’s ${sp.maxDcV} V maximum DC input.`, 'Select an inverter whose DC input range covers the bank’s charging voltage.', { node: iv.id })
    else if (sp.minDcV > 0 && vLow < sp.minDcV)
      add('warning', 'RAT-013', `At its ${chem.minSoc}% minimum the ${chem.label} bank rests at about ${vLow.toFixed(1)} V, below the inverter’s ${sp.minDcV} V minimum DC input, so the inverter cuts out early.`, 'Select an inverter whose DC input range covers the bank down to its minimum state of charge.', { node: iv.id })
    if (sp.lvd > 0) {
      const soc = bankSocAt(chem, bank.nomV, sp.lvd)
      const fix = `Set the low-voltage disconnect to about ${vLow.toFixed(1)} V (${chem.minSoc}% for ${chem.label}).`
      if (soc < chem.minSoc - 0.5)
        add('warning', 'BAT-004', `The ${sp.lvd} V low-voltage disconnect lets the ${chem.label} bank fall to about ${soc.toFixed(0)}%, below its recommended ${chem.minSoc}% minimum.`, fix, { node: iv.id })
      else if (soc > chem.minSoc + 20)
        add('warning', 'BAT-004', `The ${sp.lvd} V low-voltage disconnect shuts the inverter down at about ${soc.toFixed(0)}% charge, leaving much of the ${chem.label} bank unused.`, fix, { node: iv.id })
    }
  }
  const checkedBanks = new Set<string>()
  const reportOpenBattery = (b: LabNode) => add('warning', 'TOP-005', 'This battery string does not return to the circuit’s negative, so it is open.', 'Connect the last battery’s B− to the negative conductor.', { node: b.id })

  ccs.forEach((m) => {
    const hasStart = pvs.some((p) => same(K(p.id, 'p'), K(m.id, 'pvp')))
    if (!hasStart) add('warning', 'TOP-001', 'No PV module is connected to the controller’s PV input.', 'Connect a PV module or string to PV+ and PV−.', { node: m.id })
    const strings = findStrings(pvs, K(m.id, 'pvp'), K(m.id, 'pvn'), (cur) =>
      add('warning', 'TOP-004', 'This PV string does not return to the controller’s PV− input, so the circuit is open.', 'Connect the last module’s PV− to the controller PV− terminal.', { node: cur.id }),
    )
    const voc = strings.map((ch) => ch.reduce((a, p) => a + p.specs.voc, 0))
    const vmax = voc.length ? Math.max(...voc) : 0
    if (vmax > m.specs.maxPvV)
      add('critical', 'RAT-001', `The selected PV configuration exceeds the controller’s maximum input voltage (string Voc ${vmax.toFixed(1)} V at 25 °C, about ${coldStringVoc(strings).toFixed(1)} V on a cold morning; limit ${m.specs.maxPvV} V).`, 'Reduce the number of modules in series or select a controller with a higher PV input rating.', { node: m.id })
    checkColdVoc(m, strings, vmax, 'controller')
    if (new Set(strings.map((s) => s.length)).size > 1) add('warning', 'RAT-005', 'Parallel PV strings have different numbers of modules, so their voltages do not match.', 'Use the same number of modules in each parallel string.', { node: m.id })
    const isc = strings.reduce((a, s) => a + Math.min(...s.map((p) => p.specs.isc)), 0)
    if (m.specs.maxPvI && isc > m.specs.maxPvI)
      add('warning', 'RAT-009', `The array’s combined short-circuit current (${isc.toFixed(1)} A) exceeds the controller’s ${m.specs.maxPvI} A PV input limit.`, 'Use fewer parallel strings or a controller with a higher PV input current rating.', { node: m.id })

    const bank = bankOf(findStrings(bats, K(m.id, 'bp'), K(m.id, 'bn'), reportOpenBattery))
    if (!bank) add('warning', 'TOP-002', 'The controller’s battery terminals are not connected to a battery bank.', 'Connect BAT+ to the bank’s positive and BAT− to its negative.', { node: m.id })
    else {
      const key = bank.members.map((b) => b.id).sort().join()
      if (!checkedBanks.has(key)) {
        checkedBanks.add(key)
        checkBank(bank)
      }
      if (Math.abs(bank.nomV - m.specs.nomV) > 4)
        add('critical', 'RAT-002', `The battery configuration (${bank.nomV} V) is incompatible with the controller’s ${m.specs.nomV} V battery system voltage.`, 'Select a battery bank that matches the controller system voltage.', { node: bank.members[0].id })
      if (m.specs.maxI > bank.maxC)
        add('warning', 'RAT-006', `The controller can charge at ${m.specs.maxI} A, above the battery bank’s ${bank.maxC} A maximum charge current.`, 'Add parallel battery strings or limit the controller’s charge current.', { node: m.id })
    }
    if (!sys.bank && bank) sys.bank = bank
    if (!sys.cc && strings.length && bank) Object.assign(sys, { cc: m, bank, strings, ccOk: vmax <= m.specs.maxPvV })
  })

  invs.forEach((iv) => {
    const neg = K(iv.id, 'dn')
    // Bank positive is either the inverter DC+ net itself or the far side of a DC breaker.
    const direct = bankOf(findStrings(bats, K(iv.id, 'dp'), neg, () => {}))
    let bank = direct
    let breaker: LabNode | null = null
    if (!bank) {
      for (const d of dcbs) {
        const far = same(K(d.id, 'o'), K(iv.id, 'dp')) ? K(d.id, 'i') : same(K(d.id, 'i'), K(iv.id, 'dp')) ? K(d.id, 'o') : null
        if (!far) continue
        const b = bankOf(findStrings(bats, far, neg, () => {}))
        if (b) {
          bank = b
          breaker = d
          break
        }
      }
    } else if (fuses.length) {
      // A DC fuse conducts, so the bank is reached directly; it protects the inverter when the
      // bank positive and DC+ are only joined through it.
      const noFuse = (fuseNets ??= terminalNets(nodes, wires, (n) => n.type === 'fuse'))
      const top = K(bank.strings[0][0].id, 'p')
      if (!noFuse.same(top, K(iv.id, 'dp'))) breaker = fuses.find((f) => ['i', 'o'].some((t) => noFuse.same(K(f.id, t), K(iv.id, 'dp')) || noFuse.same(K(f.id, t), top))) ?? null
    }
    if (!bank) add('warning', 'TOP-003', 'The inverter DC input is not connected to a battery bank.', 'Connect the inverter DC+ and DC− to the battery bank.', { node: iv.id })
    else {
      const key = bank.members.map((b) => b.id).sort().join()
      if (!checkedBanks.has(key)) {
        checkedBanks.add(key)
        checkBank(bank)
      }
      if (!breaker) add('warning', 'PRT-001', 'A required protective device has not been represented between the battery and the inverter.', 'Place a DC circuit breaker or DC fuse between battery B+ and inverter DC+.', { node: iv.id })
      else if (breaker.specs.maxV < bank.nomV)
        add('warning', 'PRT-003', `The DC breaker is rated for ${breaker.specs.maxV} V DC, below the ${bank.nomV} V battery bank.`, 'Select a DC breaker rated for at least the bank voltage.', { node: breaker.id })
      if (Math.abs(bank.nomV - iv.specs.nomV) > 4)
        add('critical', 'RAT-002', `The battery configuration is incompatible with the inverter’s nominal DC voltage (${bank.nomV} V vs ${iv.specs.nomV} V).`, 'Select a battery bank or inverter with matching nominal DC voltage.', { node: iv.id })
      const draw = iv.specs.ratedP / ((iv.specs.nomV * iv.specs.eff) / 100)
      if (draw > bank.maxD)
        add('warning', 'RAT-008', `At full load the inverter draws about ${draw.toFixed(0)} A, above the battery bank’s ${bank.maxD} A maximum discharge current.`, 'Add parallel battery strings or choose a smaller inverter.', { node: iv.id })
      if (Math.abs(bank.nomV - iv.specs.nomV) <= 4) checkInverterBattery(iv, bank)
      if (breaker?.type === 'dcb') {
        // Breaker against the current the connected loads draw from the battery.
        const loadW = loads.filter((l) => same(K(l.id, 'l'), K(iv.id, 'l'))).reduce((a, l) => a + l.specs.p, 0)
        const amps = loadW / ((bank.nomV * iv.specs.eff) / 100)
        if (amps > breaker.specs.ratedI)
          add('warning', 'PRT-006', `The connected loads draw about ${amps.toFixed(0)} A from the battery, above the ${breaker.specs.ratedI} A DC breaker, so it will trip in normal use.`, `Select a breaker rated at least ${Math.ceil(amps)} A, and size the cables for it.`, { node: breaker.id })
      }
    }
    if (!gnds.some((g) => same(K(g.id, 'pe'), K(iv.id, 'pe')))) add('warning', 'GND-001', 'Incomplete grounding representation: the inverter’s protective earth (PE) is not connected.', 'Connect the inverter PE terminal to the grounding rod or the board’s earth bar.', { node: iv.id })
    const sup = loads.filter((l) => same(K(l.id, 'l'), K(iv.id, 'l')) && same(K(l.id, 'n'), K(iv.id, 'n')))
    const tot = sup.reduce((a, l) => a + l.specs.p, 0)
    if (tot > iv.specs.ratedP) add('warning', 'RAT-003', `Connected loads total ${tot} W, above the inverter’s ${iv.specs.ratedP} W continuous rating.`, 'Reduce connected loads or select a larger inverter.', { node: iv.id })
    if (!sys.inv && bank) Object.assign(sys, { inv: iv, invBank: bank, invBreaker: breaker, supplied: sup })
  })

  // ---- Grid-tied, hybrid and generator topology (P2) ----
  const grids = of(['grid'])
  const gens = of(['gen'])
  const atss = of(['ats'])
  const meters = of(['nm'])
  // Microinverters behave as one-module grid-tied inverters.
  const gtiNodes = of(['gti', 'mi'])
  const hybNodes = of(['hyb'])
  const pvStrings = (owner: LabNode, label: string) => {
    const strings = findStrings(pvs, K(owner.id, 'pvp'), K(owner.id, 'pvn'), (cur) =>
      add('warning', 'TOP-004', 'This PV string does not return to the inverter’s PV− input, so the circuit is open.', 'Connect the last module’s PV− to the PV− terminal.', { node: cur.id }),
    )
    if (!strings.length) add('warning', 'TOP-006', `No PV string is connected to the ${label}’s PV input.`, 'Connect a PV string to PV+ and PV−.', { node: owner.id })
    const voc = strings.length ? Math.max(...strings.map((ch) => ch.reduce((a, p) => a + p.specs.voc, 0))) : 0
    if (voc > owner.specs.maxPvV)
      add('critical', 'RAT-001', `The PV configuration exceeds the ${label}’s maximum input voltage (string Voc ${voc.toFixed(1)} V at 25 °C, limit ${owner.specs.maxPvV} V).`, 'Use fewer modules in series.', { node: owner.id })
    checkColdVoc(owner, strings, voc, label)
    const isc = strings.reduce((a, st) => a + Math.min(...st.map((p) => p.specs.isc)), 0)
    if (owner.specs.maxPvI && isc > owner.specs.maxPvI)
      add('warning', 'RAT-009', `The array’s combined short-circuit current (${isc.toFixed(1)} A) exceeds the ${label}’s ${owner.specs.maxPvI} A PV input limit.`, 'Use fewer parallel strings.', { node: owner.id })
    if (new Set(strings.map((st) => st.length)).size > 1) add('warning', 'RAT-005', 'Parallel PV strings have different numbers of modules, so their voltages do not match.', 'Use the same number of modules in each parallel string.', { node: owner.id })
    return strings
  }

  gtiNodes.forEach((g) => {
    const strings = pvStrings(g, g.type === 'mi' ? 'microinverter' : 'grid-tied inverter')
    const vmp = strings.length ? Math.min(...strings.map((ch) => ch.reduce((a, p) => a + p.specs.vmp, 0))) : 0
    if (strings.length && vmp < g.specs.minPvV)
      add('warning', 'RAT-010', `The string’s operating voltage (${vmp.toFixed(1)} V) is below the inverter’s ${g.specs.minPvV} V MPPT start voltage, so it may never start.`, 'Put more modules in series.', { node: g.id })
    sys.ac.gtis.push({ node: g, strings })
  })
  hybNodes.forEach((hy, i) => {
    const strings = pvStrings(hy, 'hybrid inverter')
    const bank = bankOf(findStrings(bats, K(hy.id, 'bp'), K(hy.id, 'bn'), reportOpenBattery))
    if (!bank) add('warning', 'TOP-007', 'The hybrid inverter’s battery terminals are not connected to a battery bank.', 'Connect BAT+ and BAT− to the battery bank.', { node: hy.id })
    else {
      const key = bank.members.map((b) => b.id).sort().join()
      if (!checkedBanks.has(key)) {
        checkedBanks.add(key)
        checkBank(bank)
      }
      if (Math.abs(bank.nomV - hy.specs.nomV) > 4)
        add('critical', 'RAT-002', `The battery configuration (${bank.nomV} V) is incompatible with the hybrid inverter’s ${hy.specs.nomV} V battery input.`, 'Match the battery bank voltage to the inverter.', { node: hy.id })
      if (hy.specs.maxI > bank.maxC) add('warning', 'RAT-006', `The hybrid inverter can charge at ${hy.specs.maxI} A, above the bank’s ${bank.maxC} A limit.`, 'Add parallel battery strings or lower the charge current.', { node: hy.id })
      if (!sys.bank) sys.bank = bank
    }
    if (same(K(hy.id, 'gl'), K(hy.id, 'l'))) add('critical', 'AC-001', 'The hybrid inverter’s grid input is connected to its own load output, which backfeeds the inverter.', 'Keep the grid input and the load output on separate circuits.', { node: hy.id })
    if (!gnds.some((g) => same(K(g.id, 'pe'), K(hy.id, 'pe')))) add('warning', 'GND-001', 'Incomplete grounding representation: the hybrid inverter’s protective earth (PE) is not connected.', 'Connect PE to the grounding rod or the board’s earth bar.', { node: hy.id })
    if (i === 0) sys.ac.hyb = { node: hy, strings, bank }
  })
  Object.assign(sys.ac, { grids, gens, atss, meters })

  // AC networks: meters pass straight through; transfer switches can connect either side.
  const acPar: Record<string, string> = {}
  const acFind = (k: string): string => {
    if (acPar[k] === undefined) acPar[k] = k
    while (acPar[k] !== k) {
      acPar[k] = acPar[acPar[k]]
      k = acPar[k]
    }
    return k
  }
  const acUni = (a: string, b: string) => {
    acPar[acFind(a)] = acFind(b)
  }
  const net = (n: string, t: string) => acFind(find(K(n, t)))
  meters.forEach((m) => acUni(find(K(m.id, 'gl')), find(K(m.id, 'l'))))
  const forming = [...invs, ...hybNodes, ...grids, ...gens].map((n) => ({ n, net: () => net(n.id, 'l') }))
  // Two voltage sources on one network (without a transfer switch between them) fight each other.
  const byNet = new Map<string, LabNode[]>()
  forming.forEach(({ n, net: nt }) => byNet.set(nt(), [...(byNet.get(nt()) ?? []), n]))
  byNet.forEach((list) => {
    if (list.length > 1)
      add('critical', 'AC-001', `${list.map((n) => CATALOG[n.type].name).join(' and ')} are connected to the same AC network. Two AC sources in parallel backfeed each other.`, 'Separate them, or use an automatic transfer switch to select one source at a time.', { node: list[0].id })
  })
  atss.forEach((a) => {
    acUni(find(K(a.id, 'l')), find(K(a.id, 'ml')))
    acUni(find(K(a.id, 'l')), find(K(a.id, 'bl')))
  })
  const sourceNets = new Set(forming.map((f) => f.net()))
  sys.acSupplied = loads.filter((l) => sourceNets.has(net(l.id, 'l')))
  sys.outletsSupplied = outlets.filter((o) => sourceNets.has(net(o.id, 'l'))).map((o) => o.id)
  gtiNodes.forEach((g) => {
    const n = net(g.id, 'l')
    if (!grids.some((gr) => net(gr.id, 'l') === n) && !hybNodes.some((hy) => net(hy.id, 'l') === n))
      add('warning', 'AC-002', 'The grid-tied inverter is not connected to the utility grid. It will not produce power without a grid (anti-islanding).', 'Connect its AC output to the grid side of the installation.', { node: g.id })
  })
  if (grids.length && (gtiNodes.length || hybNodes.some((h) => h.specs.exportLimit > 0)) && !meters.some((m) => grids.some((g) => same(K(g.id, 'l'), K(m.id, 'gl')))))
    add('warning', 'NM-001', 'The system can export to the grid, but there is no net meter between the grid and the installation.', 'Install a bidirectional net meter at the grid connection point.', { node: grids[0].id })

  // Batteries that are part of no complete bank but sit in an open chain.
  bats.forEach((b) => {
    if (sys.bank?.members.includes(b) || sys.invBank?.members.includes(b)) return
    const chainedFrom = bats.some((o) => o.id !== b.id && same(K(o.id, 'n'), K(b.id, 'p')))
    const chainsOn = bats.some((o) => o.id !== b.id && same(K(b.id, 'n'), K(o.id, 'p')))
    if (chainedFrom && !chainsOn && !issues.some((i) => i.rule === 'TOP-005' && i.target.node === b.id)) reportOpenBattery(b)
  })

  // Branch circuits: walk the line conductor from a terminal along wires, through outlets (whose
  // L in and sockets are one conductor), until it reaches a board circuit output (L1/L2).
  // A standalone RCCB's load side counts as a protected circuit output too; closed breakers,
  // disconnects and energy meters are walked through.
  const boardOutputs = new Set([...dbs.flatMap((d) => ['l1', 'l2'].map((t) => K(d.id, t))), ...of(['rccb']).map((r) => K(r.id, 'lo'))])
  const lineThrough = new Set(of(['mcb', 'mccb', 'acsw', 'acm']).map((n) => n.id))
  const outletIds = new Set(outlets.map((o) => o.id))
  const lineAdj = new Map<string, string[]>()
  wires.forEach((w) => {
    const a = K(w.a.n, w.a.t)
    const b = K(w.b.n, w.b.t)
    lineAdj.set(a, [...(lineAdj.get(a) ?? []), b])
    lineAdj.set(b, [...(lineAdj.get(b) ?? []), a])
  })
  const branchOf = (start: string) => {
    const seen = new Set([start])
    const queue = [start]
    const via: string[] = []
    let board: string | undefined
    while (queue.length && !board) {
      const k = queue.shift()!
      if (boardOutputs.has(k)) {
        board = k.split(':')[0]
        break
      }
      const [n, tid] = k.split(':')
      const next = [...(lineAdj.get(k) ?? [])]
      if (outletIds.has(n) && ['l', 'l1', 'l2'].includes(tid)) {
        if (!via.includes(n)) via.push(n)
        next.push(K(n, 'l'), K(n, 'l1'), K(n, 'l2'))
      }
      if (lineThrough.has(n)) conductiveGroups(nm[n]).forEach((g) => g.includes(tid) && g.forEach((x) => next.push(K(n, x))))
      next.forEach((x) => {
        if (!seen.has(x)) {
          seen.add(x)
          queue.push(x)
        }
      })
    }
    return { board, via }
  }
  loads.forEach((l) => {
    const { board, via } = branchOf(K(l.id, 'l'))
    if (board) sys.boardOf[l.id] = board
    if (via.length) sys.outletsOf[l.id] = via
  })

  outlets.forEach((o) => {
    const plugged = loads.filter((l) => sys.outletsOf[l.id]?.includes(o.id))
    const amps = plugged.reduce((a, l) => a + l.specs.p, 0) / 230
    if (amps > o.specs.ratedI)
      add('warning', 'RAT-011', `Loads plugged into this outlet draw about ${amps.toFixed(1)} A, above its ${o.specs.ratedI} A rating.`, 'Move some loads to another outlet on a separate circuit, or use an outlet rated for the load.', { node: o.id })
    if (!gnds.some((g) => same(K(g.id, 'pe'), K(o.id, 'pe'))))
      add('warning', 'GND-003', 'The outlet’s earth (PE) terminal is not connected to the earthing system.', 'Run a PE conductor from the board earth bar to the outlet PE terminal.', { node: o.id })
    const board = branchOf(K(o.id, 'l')).board
    if (board) sys.outletBoard[o.id] = board
    if (sys.outletsSupplied.includes(o.id) && !board)
      add('warning', 'PRT-004', 'This outlet is supplied without a protected branch circuit from a distribution board.', 'Feed outlets from a distribution board circuit (L1/L2) so a breaker and RCD protect them.', { node: o.id })
  })

  dbs.forEach((d) => {
    if (!gnds.some((g) => same(K(g.id, 'pe'), K(d.id, 'pe')))) add('warning', 'GND-002', 'The distribution board earth bar is not connected to a grounding rod.', 'Connect the board PE terminal to a grounding rod.', { node: d.id })
  })
  loads.forEach((l) => {
    if (!sys.acSupplied.includes(l)) add('info', 'INF-002', `${CATALOG[l.type].name} is not supplied by any AC source.`, 'Connect L and N to an inverter output, the grid side or a board circuit.', { node: l.id })
  })

  // Voltage drop needs the circuit voltage, which is known only now.
  const pvVmp = sys.strings.length ? Math.max(...sys.strings.map((s) => s.reduce((a, p) => a + p.specs.vmp, 0))) : 0
  const dcNom = sys.bank?.nomV ?? sys.invBank?.nomV ?? ccs[0]?.specs.nomV ?? invs[0]?.specs.nomV ?? 24
  const acNom = invs[0]?.specs.acV ?? 230

  // Inline devices: wire currents through them, ratings, SPDs, string fuses, open switches.
  const pvInputs = [
    ...(sys.cc ? [{ node: sys.cc, p: 'pvp', n: 'pvn', strings: sys.strings }] : []),
    ...sys.ac.gtis.filter((g) => g.node.type !== 'mi').map((g) => ({ node: g.node, p: 'pvp', n: 'pvn', strings: g.strings })),
    ...(sys.ac.hyb ? [{ node: sys.ac.hyb.node, p: 'pvp', n: 'pvn', strings: sys.ac.hyb.strings }] : []),
  ]
  checkInlineDevices({ nodes, wires, nm, same, endCurrent, add, wres, strings: [...sys.strings, ...sys.ac.gtis.flatMap((g) => g.strings), ...(sys.ac.hyb?.strings ?? [])], pvInputs, dcNom, gnds })

  wires.forEach((w) => {
    const r = wres[w.id]
    if (!r) return
    const na = nm[w.a.n]
    const nb = nm[w.b.n]
    const ta = terminal(na, w.a.t)!.t
    const onPv = isPv(na) || isPv(nb) || ['pvp', 'pvn'].includes(w.a.t) || ['pvp', 'pvn'].includes(w.b.t)
    const vNom = ta === 'pe' ? 0 : isAC(ta) ? acNom : onPv ? pvVmp || na.specs.vmp || nb.specs.vmp || 0 : dcNom
    if (!vNom || !r.I) return
    r.drop = voltageDrop(w, r.I, vNom)
    if (!r.fail && r.drop.pct > VOLTAGE_DROP_LIMIT) {
      const need = Object.keys(AMPACITY).find((g) => voltageDrop({ ...w, gauge: g }, r.I, vNom).pct <= VOLTAGE_DROP_LIMIT)
      const msg = `Estimated voltage drop is ${r.drop.pct.toFixed(1)}% (${r.drop.volts.toFixed(2)} V over ${r.drop.length} m at ${r.I.toFixed(0)} A), above the ${VOLTAGE_DROP_LIMIT}% design limit.`
      const fix = need ? `Shorten the run or use at least ${need} mm².` : 'Shorten the cable run or move equipment closer together.'
      r.fail = { sev: 'warning', rule: 'RAT-007', msg, fix }
      r.stages[3] = { name: 'Ratings', ok: false, note: msg }
    } else if (r.stages[3].ok) r.stages[3] = { ...r.stages[3], note: `${r.stages[3].note} Voltage drop ${r.drop.pct.toFixed(1)}% over ${r.drop.length} m.` }
  })
  wires.forEach((w) => {
    const f = wres[w.id]?.fail
    if (f) add(f.sev, f.rule, f.msg, f.fix, { wire: w.id })
  })

  checkShortCircuits()
  checkCoordination()
  checkBonding()

  const flagged = new Set(issues.filter((i) => i.target.node).map((i) => i.target.node))
  nodes.forEach((n) => {
    if (flagged.has(n.id)) return
    const c = CATALOG[n.type]
    const open = c.L.concat(c.R).filter((t) => !connected[K(n.id, t[0])]).map((t) => t[1])
    if (open.length) add('info', 'INF-001', `${c.name}: ${open.join(', ')} ${open.length > 1 ? 'are' : 'is'} not connected.`, 'Connect the terminal or leave it as a spare.', { node: n.id })
  })

  // Stages 5 (topology) and 6 (protection) run after the per-wire stages 1–4. Every finding carries
  // its stage; the list is ordered by severity, then stage (a stable sort keeps it deterministic).
  issues.forEach((i) => (i.stage = stageOf(i.rule)))
  issues.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || a.stage! - b.stage!)
  const stages: StageSummary[] = STAGE_NAMES.map((name, i) => {
    const hits = issues.filter((x) => x.stage === i + 1)
    return { stage: i + 1, name, count: hits.length, status: hits.some((x) => x.sev === 'critical') ? 'fail' : hits.some((x) => x.sev === 'warning') ? 'warning' : 'pass' }
  })
  const crit = issues.some((i) => i.sev === 'critical')
  sys.ok = !crit && sys.ccOk && !!sys.cc
  sys.invOk = !crit && !!sys.inv
  sys.hybOk = !crit && !!sys.ac.hyb?.bank
  return { issues, stages, wres, sys, nodes, wires }

  /**
   * SHC-001: each PV module or battery raises the potential from its − net to its + net. A
   * directed cycle through those sources is a closed loop with no load: a short circuit. Nets
   * include busbars and closed switches; DC breakers count as closed.
   */
  function checkShortCircuits() {
    const sPar = new Map<string, string>()
    const sFind = (k: string) => {
      let r = find(k)
      while (sPar.has(r)) r = sPar.get(r)!
      return r
    }
    dcbs.forEach((d) => {
      const a = sFind(K(d.id, 'i'))
      const b = sFind(K(d.id, 'o'))
      if (a !== b) sPar.set(a, b)
    })
    const sources = [...pvs, ...bats].filter((n) => connected[K(n.id, 'p')] || connected[K(n.id, 'n')])
    const out = new Map<string, LabNode[]>()
    sources.forEach((n) => {
      const from = sFind(K(n.id, 'n'))
      out.set(from, [...(out.get(from) ?? []), n])
    })
    const reported = new Set<string>()
    const state = new Map<string, number>()
    const stack: LabNode[] = []
    const visit = (netId: string) => {
      state.set(netId, 1)
      for (const n of out.get(netId) ?? []) {
        stack.push(n)
        const to = sFind(K(n.id, 'p'))
        if (state.get(to) === 1) {
          // The cycle is the sources on the stack since the net `to` was entered.
          const start = stack.findIndex((x) => sFind(K(x.id, 'n')) === to)
          const loop = stack.slice(start)
          const key = loop.map((x) => x.id).sort().join()
          if (!reported.has(key)) {
            reported.add(key)
            const what = loop.length === 1 ? `the + and − of the ${CATALOG[loop[0].type].name}` : `the ends of a series chain of ${loop.length} ${isPv(loop[0]) ? 'PV modules' : 'batteries'}`
            add('critical', 'SHC-001', `DC short circuit: ${what} are joined by one conductor, with no load between them.`, 'Remove the conductor that joins the positive and negative, and check every series link runs − to + once.', { node: loop[0].id })
          }
        } else if (!state.has(to)) visit(to)
        stack.pop()
      }
      state.set(netId, 2)
    }
    sources.forEach((n) => {
      const from = sFind(K(n.id, 'n'))
      if (!state.has(from)) visit(from)
    })
  }

  /** PRT-005: an overcurrent device must not be rated above the ampacity of a conductor it connects to. */
  function checkCoordination() {
    nodes.forEach((n) => {
      if (!['dcb', 'fuse', 'mcb', 'mccb'].includes(n.type) || !n.specs.ratedI) return
      const thin = wires
        .filter((w) => (w.a.n === n.id && w.a.t !== 'pe') || (w.b.n === n.id && w.b.t !== 'pe'))
        .filter((w) => AMPACITY[w.gauge] !== undefined && AMPACITY[w.gauge] < n.specs.ratedI)
        .sort((a, b) => AMPACITY[a.gauge] - AMPACITY[b.gauge])
      if (thin.length) {
        const need = Object.keys(AMPACITY).find((g) => AMPACITY[g] >= n.specs.ratedI)
        add('warning', 'PRT-005', `The ${CATALOG[n.type].name} is rated ${n.specs.ratedI} A, but a ${thin[0].gauge} mm² conductor on it carries only ${AMPACITY[thin[0].gauge]} A, so the cable is not protected.`, need ? `Use at least ${need} mm² on this device, or a device rated at or below ${AMPACITY[thin[0].gauge]} A.` : `Use a device rated at or below ${AMPACITY[thin[0].gauge]} A.`, { node: n.id })
      }
    })
  }

  /** BND-001: PV frames, controllers and battery enclosures with a PE terminal must be bonded to earth. */
  function checkBonding() {
    nodes.forEach((n) => {
      if (!(isPv(n) || isBattery(n) || n.type === 'mppt' || n.type === 'pwm')) return
      const def = CATALOG[n.type]
      const all = def.L.concat(def.R)
      if (!all.some((t) => t[0] === 'pe')) return
      const inUse = all.some((t) => t[2] !== 'pe' && connected[K(n.id, t[0])])
      if (inUse && !gnds.some((g) => same(K(g.id, 'pe'), K(n.id, 'pe'))))
        add('warning', 'BND-001', `The ${def.name}’s ${isPv(n) ? 'frame' : isBattery(n) ? 'enclosure' : 'case'} is not bonded to earth (its PE terminal does not reach the grounding system).`, 'Run an equipment bonding conductor from its PE terminal to the earth bar or grounding rod.', { node: n.id })
    })
  }
}

let cache: { nodes: LabNode[]; wires: Wire[]; result: ValidationResult } | null = null

/** validate() memoised on the nodes/wires array identities, so every panel shares one run. */
export function validateCached(nodes: LabNode[], wires: Wire[]) {
  if (cache && cache.nodes === nodes && cache.wires === wires) return cache.result
  const result = validate(nodes, wires)
  cache = { nodes, wires, result }
  return result
}
