import { CATALOG, SPEEDS } from './catalog'
import { fuelRate, generatorDemand, solveAc, type AcResult } from './ac'
import { bankOcv, chemistryOf, CHEMISTRIES, type ChemistryDef } from './battery-chem'
import { activeFaults, describeFault, faultOn, type Fault } from './faults'
import { PRIORITY_LABEL, loadPriority, surgeRefused } from './loads'
import { ambientTemp, cellTemp, moduleDcPower, voltTempFactor } from './pv-model'
import { faultedValidation, readMeters, type MeterReading } from './runtime'
import { scheduledOn } from './schedule'
import type { LabNode, Severity } from './types'
import type { BatteryBank, ValidationResult } from './validation'

/**
 * Simplified educational model: P_PV = P_STC × (G ÷ 1000) × f, with module temperature,
 * orientation and bifacial gain as separate factors (pv-model.ts).
 */
export { PERFORMANCE_FACTOR } from './pv-model'
/** Minutes an inverter may run above its continuous rating before thermal protection trips it. */
export const THERMAL_TRIP_MIN = 30
/** Minutes the inverter stays off to cool down after a thermal trip. */
export const THERMAL_COOL_MIN = 30
const HISTORY_POINTS = 288

export interface SimSample {
  pv: number
  load: number
  soc: number
}

export interface SimState {
  /** Simulated minutes since Day 1 00:00. */
  t: number
  soc: number
  eGen: number
  eUse: number
  hist: SimSample[]
  /** Low-voltage disconnect active. */
  lvd: boolean
  started: boolean
  lastLoads: string
  ovl?: boolean
  curt?: boolean
  /** AC boards whose RCD has tripped (stay off until reset). */
  rcdTripped?: string[]
  /** Fault ids whose onset has been logged. */
  seenFaults?: string[]
  /** Running generators. */
  genOn?: string[]
  /** Grid energy, kWh. */
  eImport?: number
  eExport?: number
  /** Generator fuel used, litres, and run time, hours. */
  fuel?: number
  genHours?: number
  /** Energy through each DC/AC meter, Wh (+ consumption, − charging or export). */
  meterWh?: Record<string, number>
  /** Lithium BMS low-SOC cut-off active (discharge disconnected, charging allowed). */
  bmsLow?: boolean
  /** Lead-acid bank below its recommended minimum SOC (warned once per excursion). */
  deepDis?: boolean
  /** Battery-low load shedding level: 0 none, 1 priority 3 shed, 2 priorities 2–3 shed. */
  shedLevel?: number
  /** Loads currently shed (logged on change). */
  shed?: string[]
  /** Loads refused at start-up by a surge overload; they wait for their next scheduled start. */
  surgeBlocked?: string[]
  /** Minutes the off-grid inverter has run above its continuous rating (cools down when not). */
  ovlMin?: number
  /** Simulated time until which the inverter is off after a thermal trip. */
  thermalUntil?: number
  /** BMS over-current state (logged on change). */
  bmsOc?: boolean
  /** Charging limited by the bank's maximum charge current (logged on change). */
  chgLim?: boolean
  /** Energy used by each load since the start, kWh. */
  loadKwh?: Record<string, number>
}

export interface LogEntry {
  time: string
  sev: Severity
  text: string
}

export interface Measurements {
  G: number
  h: number
  ppv: number
  vpv: number
  ipv: number
  /** Power the controller delivers, W. */
  cc: number
  vbat: number
  pbat: number
  pinv: number
  pload: number
  loss: number
  invOn: boolean
  curtailed: boolean
  overload: boolean
  onLoads: LabNode[]
  ah: number
  /** Battery bank disconnected by its BMS. */
  bmsOff: boolean
  /** Inverter DC supply open (tripped breaker or BMS cut-off). */
  dcOff: boolean
  /** Inverter derated by over-temperature. */
  derated: boolean
  /** Supplied loads switched off by a tripped RCD. */
  rcdOff: LabNode[]
  /** Per-module output factor after shading and failures (1 = healthy). */
  moduleFactor: Record<string, number>
  /** AC-side results: grid, generator, hybrid and grid-tied inverter flows. */
  ac: AcResult
  /** Live readings of DC shunt meters and AC energy meters, by node id. */
  meters: Record<string, MeterReading>
  /** Ambient and PV cell temperature (first module), °C. */
  tamb: number
  tcell: number
  /** DC output of each PV module, W. */
  modulePower: Record<string, number>
  /** Battery bank nominal voltage, V (0 without a usable bank). */
  vnom: number
  /** Chemistry of the bank (LiFePO4 when there is none). */
  chem: ChemistryDef
  /** Charging limited by the bank's maximum charge current. */
  chargeLimited: boolean
  /** Off-grid inverter off by thermal protection after sustained overload. */
  thermalTrip: boolean
  /** Inverter output frequency, Hz (0 when no inverter is running). */
  freq: number
}

export function freshSim(): SimState {
  return { t: 360, soc: 62, eGen: 0, eUse: 0, hist: [], lvd: false, started: false, lastLoads: '' }
}

export function clockStr(t: number) {
  const d = Math.floor(t / 1440) + 1
  const h = Math.floor((t % 1440) / 60)
  const m = Math.floor(t % 60)
  return `Day ${d} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isDaylight(t: number) {
  const h = (t / 60) % 24
  return h >= 6 && h < 18
}

/** Irradiance at simulated time `t` (minutes), W/m². */
export function irradiance(t: number, clear: number) {
  const h = (t / 60) % 24
  return h > 6 && h < 18 ? (1000 * Math.sin((Math.PI * (h - 6)) / 12) * clear) / 100 : 0
}

export { scheduledOn }

export function compute(sim: SimState, v0: ValidationResult, clear: number, faults: readonly Fault[] = []): Measurements {
  // A blown fuse or a tripped AC breaker opens its circuit (engine/runtime.ts).
  const v = faultedValidation(v0, activeFaults(faults, sim.t))
  const s = v.sys
  const h = (sim.t / 60) % 24
  const G = irradiance(sim.t, clear)
  const act = activeFaults(faults, sim.t)
  const out: Measurements = {
    G,
    h,
    ppv: 0,
    vpv: 0,
    ipv: 0,
    cc: 0,
    vbat: 0,
    pbat: 0,
    pinv: 0,
    pload: 0,
    loss: 0,
    invOn: false,
    curtailed: false,
    overload: false,
    onLoads: [],
    ah: 0,
    bmsOff: false,
    dcOff: false,
    derated: false,
    rcdOff: [],
    moduleFactor: {},
    ac: undefined as unknown as AcResult,
    meters: {},
    tamb: ambientTemp(h),
    tcell: ambientTemp(h),
    modulePower: {},
    vnom: 0,
    chem: CHEMISTRIES.lfp,
    chargeLimited: false,
    thermalTrip: (sim.thermalUntil ?? -1) > sim.t,
    freq: 0,
  }
  const bank = s.bank || s.invBank
  out.bmsOff = !!bank?.members.some((b) => faultOn(act, b.id, 'bms-cutoff'))
  const nomV = bank && !out.bmsOff ? bank.nomV : 0
  const ah = bank && !out.bmsOff ? bank.ah : 0
  if (bank) out.chem = chemistryOf(bank.members[0])
  out.vnom = nomV
  // Resting (open-circuit) voltage of the bank's chemistry at this state of charge.
  out.vbat = nomV ? bankOcv(out.chem, nomV, sim.soc) : 0
  const firstPv = [...s.strings, ...(s.ac.hyb?.strings ?? []), ...s.ac.gtis.flatMap((g) => g.strings)].flat()[0]
  if (firstPv) out.tcell = cellTemp(firstPv, G, h)

  // A failed module opens its whole series string; shading removes part of a module's output,
  // and a module more than half shaded is bypassed (it drops out of the string voltage).
  const stringsPower = (strings: LabNode[][]) => {
    let pstc = 0
    let ptot = 0
    let vmp = 0
    for (const ch of strings) {
      const open = ch.some((p) => faultOn(act, p.id, 'module-open'))
      let sp = 0
      let sv = 0
      for (const p of ch) {
        const shade = open ? 1 : (faultOn(act, p.id, 'shading')?.shade ?? 0)
        out.moduleFactor[p.id] = open ? 0 : 1 - shade
        const pw = moduleDcPower(p, G, h) * (1 - shade)
        out.modulePower[p.id] = open ? 0 : pw
        sp += pw
        pstc += p.specs.ratedPower * (1 - shade)
        sv += shade >= 0.5 ? 0 : p.specs.vmp * voltTempFactor(p, cellTemp(p, G, h))
      }
      if (open) continue
      ptot += sp
      vmp = Math.max(vmp, sv)
    }
    return { p: ptot, vmp, pstc }
  }
  const crit = !s.ok && !s.invOk && !s.hybOk && v.issues.some((i) => i.sev === 'critical')

  if (s.ok && s.cc) {
    const { p, vmp, pstc } = stringsPower(s.strings)
    out.ppv = p
    out.vpv = G > 0 && pstc > 0 ? vmp * (0.92 + (0.08 * G) / 1000) : 0
    out.ipv = out.vpv ? out.ppv / out.vpv : 0
    out.cc = out.bmsOff ? 0 : Math.min((out.ppv * s.cc.specs.eff) / 100, s.cc.specs.maxI * out.vbat)
  }
  out.dcOff = out.bmsOff || (!!s.invBreaker && !!faultOn(act, s.invBreaker.id, 'breaker-trip')) || (!!v0.sys.inv && !s.inv)

  const pvAc = (strings: LabNode[][]) => (crit ? 0 : stringsPower(strings).p)
  const invBank: BatteryBank | null = s.invBank ?? bank
  const ac = solveAc(
    v,
    act,
    h,
    {
      vbat: out.vbat,
      bmsOff: out.bmsOff,
      dcOff: out.dcOff,
      soc: sim.soc,
      // The BMS low cut-off blocks discharge just like the inverter's low-voltage disconnect.
      lvd: !!sim.lvd || !!sim.bmsLow,
      pvPower: pvAc,
      shedLevel: sim.shedLevel ?? 0,
      surgeBlocked: sim.surgeBlocked ?? [],
      dischargeW: invBank && out.vbat ? invBank.maxD * out.vbat + (s.bank && s.invBank && s.bank.members.every((b) => s.invBank!.members.includes(b)) ? out.cc : 0) : undefined,
      invTripped: out.thermalTrip,
      minSoc: out.chem.minSoc,
      bankMaxC: bank?.maxC,
    },
    sim.rcdTripped ?? [],
    sim.genOn ?? [],
  )
  out.ac = ac
  // Hybrid and grid-tied PV count toward total generation.
  if (!crit) {
    const extra = [...(s.ac.hyb ? [s.ac.hyb.strings] : []), ...s.ac.gtis.map((g) => g.strings)].reduce((a, st) => a + stringsPower(st).p, 0)
    out.ppv += extra
    if (!s.cc && extra > 0) {
      const all = [...(s.ac.hyb?.strings ?? []), ...s.ac.gtis.flatMap((g) => g.strings)]
      const { vmp } = stringsPower(all)
      out.vpv = G > 0 ? vmp * (0.92 + (0.08 * G) / 1000) : 0
      out.ipv = out.vpv ? out.ppv / out.vpv : 0
    }
  }
  out.onLoads = ac.onLoads
  out.rcdOff = ac.rcdOff
  out.pload = ac.pload
  out.invOn = ac.invOn || ac.hybMode === 'battery' || ac.hybMode === 'grid' || ac.hybMode === 'generator'
  out.overload = ac.overload || ac.hybOverload || ac.genOverload
  out.derated = ac.derated
  out.pinv = ac.pinv
  // The controller output covers the inverter first; the rest charges the bank, up to its limit.
  if (bank && out.vbat && out.cc - out.pinv > bank.maxC * out.vbat) {
    out.cc = out.pinv + bank.maxC * out.vbat
    out.chargeLimited = true
  }
  out.pbat = out.cc - out.pinv + ac.hybBattery
  if (sim.soc >= 100 && out.pbat > 0) {
    out.curtailed = true
    out.cc = out.pinv
    out.pbat = 0
  }
  out.loss =
    Math.max(0, out.ppv - (out.curtailed || out.chargeLimited ? out.ppv * (s.cc ? s.cc.specs.eff / 100 : 1) : out.cc) - ac.hybPv - ac.gtiAc) +
    Math.max(0, out.pinv - (ac.invOn ? out.pload : 0)) +
    ac.hybCurtailed +
    // Charging loss inside the battery (round-trip efficiency of its chemistry).
    Math.max(0, out.pbat) * (1 - out.chem.chargeEff)
  out.ah = ah
  const hybOn = ac.hybMode === 'battery' || ac.hybMode === 'grid' || ac.hybMode === 'generator'
  out.freq = ac.invOn && s.inv ? s.inv.specs.freq || 60 : hybOn && s.ac.hyb ? s.ac.hyb.node.specs.freq || 60 : 0
  out.meters = readMeters(v, out, sim.t, faults)
  return out
}

/** Advance one tick. Returns the next sim state and new log entries (newest first). */
/** `dtMin` overrides the tick length in simulated minutes (the configurable time step); default from `speedIdx`. */
export function step(prev: SimState, v: ValidationResult, clear: number, speedIdx: number, nodes: LabNode[], faults: readonly Fault[] = [], dtMin?: number) {
  const dt = dtMin ?? SPEEDS[speedIdx][1]
  const sim: SimState = { ...prev, started: true }
  const logs: LogEntry[] = []
  const stamp = clockStr(sim.t)

  // Fault onsets. Hidden faults log their symptom, not their cause.
  const seen = new Set(sim.seenFaults ?? [])
  for (const f of activeFaults(faults, sim.t)) {
    if (seen.has(f.id)) continue
    seen.add(f.id)
    const node = nodes.find((n) => n.id === f.target)
    if (!f.hidden) logs.push({ time: stamp, sev: 'warning', text: `Fault: ${describeFault(f, node)}.` })
  }
  sim.seenFaults = [...seen]

  // Generator auto-start / auto-stop.
  const h = (sim.t / 60) % 24
  if (v.sys.ac.gens.length) {
    const act = activeFaults(faults, sim.t)
    const bankNow = v.sys.bank || v.sys.invBank
    const bmsOff = !!bankNow?.members.some((b) => faultOn(act, b.id, 'bms-cutoff'))
    const dcOff = bmsOff || (!!v.sys.invBreaker && !!faultOn(act, v.sys.invBreaker.id, 'breaker-trip'))
    const invAvail = !!(v.sys.invOk && v.sys.inv && !sim.lvd && !dcOff)
    const hybOk = !!(v.sys.hybOk && v.sys.ac.hyb?.bank && !bmsOff)
    const want = generatorDemand(v, act, h, sim.soc, sim.genOn ?? [], invAvail, (gridSide) => !!v.sys.hybOk && (gridSide || (hybOk && !sim.lvd)))
    const was = new Set(sim.genOn ?? [])
    for (const id of want) {
      if (was.has(id)) continue
      const g = nodes.find((n) => n.id === id)!
      logs.push({ time: stamp, sev: faultOn(act, id, 'gen-fail') ? 'critical' : 'info', text: faultOn(act, id, 'gen-fail') ? `${CATALOG[g.type].name} failed to start.` : `${CATALOG[g.type].name} auto-started.` })
    }
    for (const id of was) if (!want.includes(id)) logs.push({ time: stamp, sev: 'info', text: 'Generator stopped.' })
    sim.genOn = want
  }

  // Earth leakage trips the RCD of the board feeding an energised faulty appliance.
  const tripped = new Set(sim.rcdTripped ?? [])
  for (const f of activeFaults(faults, sim.t)) {
    if (f.kind !== 'ground-fault') continue
    const load = v.sys.acSupplied.find((l) => l.id === f.target)
    if (!load || !scheduledOn(load, h) || (!v.sys.invOk && !v.sys.hybOk && !v.sys.ac.grids.length && !v.sys.ac.gens.length)) continue
    const board = v.sys.boardOf[load.id]
    if (board && !tripped.has(board)) {
      tripped.add(board)
      logs.push(
        nodes.find((n) => n.id === board)?.type === 'rccb'
          ? { time: stamp, sev: 'critical', text: 'RCCB tripped: earth leakage detected. Loads downstream of it are off until the RCCB is reset.' }
          : { time: stamp, sev: 'critical', text: 'RCD tripped on the AC distribution board: earth leakage detected. Loads on that board are off until the RCD is reset.' },
      )
    } else if (!board && !seen.has(f.id + ':unprotected')) {
      seen.add(f.id + ':unprotected')
      sim.seenFaults = [...seen]
      logs.push({ time: stamp, sev: 'critical', text: `Earth leakage on ${CATALOG[load.type].name} with no RCD in the circuit. Exposed metal may be live.` })
    }
  }
  sim.rcdTripped = [...tripped]

  // Surge at switch-on: loads starting this tick on an inverter-formed island must fit its surge rating.
  sim.surgeBlocked = (sim.surgeBlocked ?? []).filter((id) => {
    const l = nodes.find((n) => n.id === id)
    return !!l && scheduledOn(l, h)
  })
  let m = compute(sim, v, clear, faults)
  {
    const prevIds = new Set(sim.lastLoads ? sim.lastLoads.split(',') : [])
    const refusedNow: string[] = []
    for (const [src, node] of [['inv', v.sys.inv], ['hyb', v.sys.ac.hyb?.node]] as const) {
      if (!node) continue
      const on = m.onLoads.filter((l) => m.ac.sourceOf[l.id] === src)
      const starting = on.filter((l) => !prevIds.has(l.id))
      const { refused, peak } = surgeRefused(
        on.filter((l) => prevIds.has(l.id)),
        starting,
        node.specs.surgeP ?? 0,
      )
      for (const l of refused) {
        refusedNow.push(l.id)
        logs.push({ time: stamp, sev: 'critical', text: `Inverter surge overload: ${CATALOG[l.type].name} could not start (start-up peak about ${peak.toFixed(0)} W, surge rating ${node.specs.surgeP} W).` })
      }
    }
    if (refusedNow.length) {
      sim.surgeBlocked = [...sim.surgeBlocked, ...refusedNow]
      m = compute(sim, v, clear, faults)
    }
  }
  // Log loss of DC supply once per outage.
  if (m.dcOff && !(sim.seenFaults ?? []).includes('dc-off-logged')) {
    logs.push({ time: stamp, sev: 'critical', text: m.bmsOff ? 'Battery BMS disconnected the bank. No charging and no inverter output.' : 'Inverter has no DC input. Loads are off.' })
    sim.seenFaults = [...(sim.seenFaults ?? []), 'dc-off-logged']
  }
  if (!m.dcOff && (sim.seenFaults ?? []).includes('dc-off-logged')) sim.seenFaults = (sim.seenFaults ?? []).filter((x) => x !== 'dc-off-logged')

  // Charging stores pbat × chemistry efficiency; the bank's energy is nominal voltage × capacity.
  if (m.ah && m.vnom) {
    const stored = m.pbat > 0 ? m.pbat * m.chem.chargeEff : m.pbat
    sim.soc = Math.max(0, Math.min(100, sim.soc + ((stored * (dt / 60)) / (m.vnom * m.ah)) * 100))
  }
  sim.eGen += (m.ppv * (dt / 60)) / 1000
  sim.eUse += (m.pload * (dt / 60)) / 1000
  if (m.onLoads.length) {
    const kwh = { ...(sim.loadKwh ?? {}) }
    for (const l of m.onLoads) kwh[l.id] = (kwh[l.id] ?? 0) + (l.specs.p * (dt / 60)) / 1000
    sim.loadKwh = kwh
  }
  const meterIds = Object.keys(m.meters)
  if (meterIds.length) {
    const wh = { ...sim.meterWh }
    for (const id of meterIds) wh[id] = (wh[id] ?? 0) + m.meters[id].w * (dt / 60)
    sim.meterWh = wh
  }
  if (m.ac.pgrid > 0) sim.eImport = (sim.eImport ?? 0) + (m.ac.pgrid * (dt / 60)) / 1000
  if (m.ac.pgrid < 0) sim.eExport = (sim.eExport ?? 0) + (-m.ac.pgrid * (dt / 60)) / 1000
  for (const id of sim.genOn ?? []) {
    const g = nodes.find((n) => n.id === id)
    if (!g) continue
    sim.fuel = (sim.fuel ?? 0) + fuelRate(g, m.ac.pgen) * (dt / 60)
    sim.genHours = (sim.genHours ?? 0) + dt / 60
  }
  if (m.ac.gtiIslanded && !(sim.seenFaults ?? []).includes('gti-islanded')) {
    logs.push({ time: stamp, sev: 'warning', text: 'Grid-tied inverter disconnected: no grid present (anti-islanding protection).' })
    sim.seenFaults = [...(sim.seenFaults ?? []), 'gti-islanded']
  }
  if (!m.ac.gtiIslanded && (sim.seenFaults ?? []).includes('gti-islanded')) sim.seenFaults = (sim.seenFaults ?? []).filter((x) => x !== 'gti-islanded')
  logs.push(...batteryEvents(sim, v, m, stamp))
  logs.push(...inverterEvents(sim, v, m, stamp, dt))
  if (m.curtailed && !sim.curt) logs.push({ time: stamp, sev: 'info', text: 'Battery full. Charge controller is curtailing PV input.' })
  sim.curt = m.curtailed

  // Load shedding (battery low or overload), logged when it changes.
  const shedNow = m.ac.shed.map((x) => x.id)
  const shedBefore = new Set(sim.shed ?? [])
  for (const x of m.ac.shed) {
    if (shedBefore.has(x.id)) continue
    const n = nodes.find((y) => y.id === x.id)
    if (n) logs.push({ time: stamp, sev: 'warning', text: `Load shedding: ${CATALOG[n.type].name} switched off (${PRIORITY_LABEL[loadPriority(n)].toLowerCase()} load, ${x.reason === 'battery' ? 'battery low' : 'inverter at its limit'}).` })
  }
  for (const id of shedBefore) {
    if (shedNow.includes(id)) continue
    const n = nodes.find((y) => y.id === id)
    if (n && m.onLoads.includes(n)) logs.push({ time: stamp, sev: 'info', text: `Load shedding ended: ${CATALOG[n.type].name} restored.` })
  }
  sim.shed = shedNow

  const lk = m.onLoads.map((l) => l.id).join(',')
  if (lk !== sim.lastLoads) {
    const prevIds = sim.lastLoads ? sim.lastLoads.split(',') : []
    const quiet = new Set([...shedNow, ...(sim.surgeBlocked ?? [])])
    m.onLoads.filter((l) => !prevIds.includes(l.id)).forEach((l) => logs.push({ time: stamp, sev: 'info', text: `${CATALOG[l.type].name} switched on (${l.specs.p} W).` }))
    prevIds
      .filter((id) => !m.onLoads.some((l) => l.id === id) && !quiet.has(id))
      .forEach((id) => {
        const n = nodes.find((x) => x.id === id)
        if (n) logs.push({ time: stamp, sev: 'info', text: `${CATALOG[n.type].name} switched off.` })
      })
    sim.lastLoads = lk
  }

  const sr = Math.floor(((sim.t + dt) / 60) % 24)
  const pr = Math.floor((sim.t / 60) % 24)
  if (sr !== pr && sr === 6) logs.push({ time: clockStr(sim.t + dt), sev: 'info', text: 'Sunrise. PV generation begins.' })
  if (sr !== pr && sr === 18) logs.push({ time: clockStr(sim.t + dt), sev: 'info', text: 'Sunset. Loads now run from the battery.' })

  sim.hist = sim.hist.concat([{ pv: m.ppv, load: m.pload, soc: sim.soc }]).slice(-HISTORY_POINTS)
  sim.t += dt
  return { sim, logs: logs.reverse() }
}

/**
 * Battery protection (PRD §6.3): the inverter's low-voltage disconnect (by battery voltage, with
 * reconnect hysteresis), the lithium BMS low-SOC cut-off, a lead-acid deep-discharge warning,
 * charge-current limiting and battery-low load shedding. Mutates `sim`, returns log entries.
 */
function batteryEvents(sim: SimState, v: ValidationResult, m: Measurements, stamp: string): LogEntry[] {
  const logs: LogEntry[] = []
  const bank = v.sys.bank || v.sys.invBank
  const chem = m.chem
  const vNow = m.vnom ? bankOcv(chem, m.vnom, sim.soc) : 0
  const inv = v.sys.invOk ? v.sys.inv : null
  if (inv && inv.specs.lvd > 0 && vNow > 0) {
    const lvd = inv.specs.lvd
    const lvr = Math.max(inv.specs.lvr || 0, lvd)
    if (!sim.lvd && vNow <= lvd) {
      sim.lvd = true
      logs.push({ time: stamp, sev: 'critical', text: `Inverter low-voltage shutdown: battery at ${vNow.toFixed(1)} V (disconnect setting ${lvd} V, about ${sim.soc.toFixed(0)}% SOC).` })
    } else if (sim.lvd && vNow >= lvr) {
      sim.lvd = false
      logs.push({ time: stamp, sev: 'info', text: `Battery recovered to ${vNow.toFixed(1)} V (reconnect ${lvr} V). Inverter restarted.` })
    }
  } else if (v.sys.invOk || v.sys.hybOk) {
    // No voltage setting (hybrid): disconnect at the chemistry's recommended minimum SOC.
    if (!sim.lvd && sim.soc <= chem.minSoc) {
      sim.lvd = true
      logs.push({ time: stamp, sev: 'critical', text: `Inverter low-voltage shutdown: battery state of charge reached ${chem.minSoc}%.` })
    } else if (sim.lvd && sim.soc >= chem.minSoc + 10) {
      sim.lvd = false
      logs.push({ time: stamp, sev: 'info', text: `Battery recovered to ${chem.minSoc + 10}%. Inverter restarted.` })
    }
  }
  if (bank && m.vnom) {
    if (chem.bms) {
      if (!sim.bmsLow && sim.soc <= chem.cutoffSoc) {
        sim.bmsLow = true
        logs.push({ time: stamp, sev: 'critical', text: `BMS low-voltage cut-off: the ${chem.label} bank reached ${chem.cutoffSoc}% and disconnected its discharge. Charging is still allowed.` })
      } else if (sim.bmsLow && sim.soc >= chem.cutoffSoc + 5) {
        sim.bmsLow = false
        logs.push({ time: stamp, sev: 'info', text: 'BMS reconnected the battery after recharging.' })
      }
    } else if (!sim.deepDis && sim.soc < chem.minSoc) {
      sim.deepDis = true
      logs.push({ time: stamp, sev: 'warning', text: `Deep discharge: the ${chem.label} bank is below its recommended ${chem.minSoc}% minimum. Repeated deep cycles shorten its life (it has no BMS).` })
    } else if (sim.deepDis && sim.soc >= chem.minSoc + 5) sim.deepDis = false
    if (m.chargeLimited && !sim.chgLim) logs.push({ time: stamp, sev: 'info', text: `Charge current limited to the battery bank’s ${bank.maxC} A maximum.` })
    sim.chgLim = m.chargeLimited
  }
  // Battery-low load shedding with 5% hysteresis (off-grid inverter setting).
  const shedSoc = inv?.specs.shedSoc ?? 0
  const level = sim.shedLevel ?? 0
  let next = level
  if (!shedSoc) next = 0
  else if (sim.soc < shedSoc - 10) next = 2
  else if (sim.soc < shedSoc) next = Math.max(level, 1)
  if (shedSoc && level === 2 && sim.soc >= shedSoc - 5) next = sim.soc >= shedSoc + 5 ? 0 : 1
  else if (shedSoc && level === 1 && sim.soc >= shedSoc + 5) next = 0
  sim.shedLevel = next
  return logs
}

/** Overload, BMS over-current and thermal protection of the off-grid inverter. Mutates `sim`. */
function inverterEvents(sim: SimState, v: ValidationResult, m: Measurements, stamp: string, dt: number): LogEntry[] {
  const logs: LogEntry[] = []
  if (m.overload && !sim.ovl) logs.push({ time: stamp, sev: 'critical', text: 'Inverter overload: connected loads exceed continuous output. Output switched off.' })
  sim.ovl = m.overload
  const bank = v.sys.invBank ?? v.sys.bank
  if (m.ac.bmsOvercurrent && !sim.bmsOc && bank)
    logs.push({ time: stamp, sev: 'critical', text: `BMS over-current protection: the loads would draw more than the bank’s ${bank.maxD} A discharge limit. The battery disconnected the inverter.` })
  sim.bmsOc = m.ac.bmsOvercurrent
  // Sustained overload: a deterministic minute counter heats the inverter until it trips.
  if (m.ac.invStrained) {
    sim.ovlMin = (sim.ovlMin ?? 0) + dt
    if (sim.ovlMin >= THERMAL_TRIP_MIN) {
      sim.thermalUntil = sim.t + THERMAL_COOL_MIN
      sim.ovlMin = 0
      logs.push({ time: stamp, sev: 'critical', text: `Inverter thermal protection: ${THERMAL_TRIP_MIN} minutes above its continuous rating. Output off for ${THERMAL_COOL_MIN} minutes to cool down.` })
    } else if ((sim.ovlMin ?? 0) <= dt) logs.push({ time: stamp, sev: 'warning', text: `Inverter running above its continuous rating (${(v.sys.inv?.specs.ratedP ?? 0).toFixed(0)} W). It will trip if this continues.` })
  } else sim.ovlMin = Math.max(0, (sim.ovlMin ?? 0) - dt)
  if (sim.thermalUntil !== undefined && sim.thermalUntil <= sim.t) {
    sim.thermalUntil = undefined
    logs.push({ time: stamp, sev: 'info', text: 'Inverter cooled down. Output restored.' })
  }
  return logs
}

export { HISTORY_POINTS }
