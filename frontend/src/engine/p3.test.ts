/**
 * PRD gap closure: battery chemistries and limits, PV variants and the temperature/orientation
 * model, load surge and priority, inverter protection, the rule registry's corrective actions,
 * ordered validation stages, DC short circuits, protective-device coordination and bonding.
 */
import { describe, expect, it } from 'vitest'

import { CHEMISTRIES, CHEM_OF, bankOcv, bankSocAt, cellOcv, chemistryOf, socAtCellV } from './battery-chem'
import { BATTERY_TYPES, CATALOG, PV_TYPES, makeNode } from './catalog'
import { parseCatalog } from './catalog-import'
import { FAULT_DEFS } from './faults'
import { layout3d } from './layout3d'
import { loadOrderForShedding, surgeRefused } from './loads'
import { measureNode } from './measure'
import { PROFILES } from './profiles'
import { DESIGN_MIN_TEMP, coldVoc, moduleDcPower, orientationFactor } from './pv-model'
import { RULES, STAGE_ORDER, fixFor } from './rules'
import { sampleProject } from './sample-project'
import { simulateDays } from './scenario'
import { compute, freshSim, step, type SimState } from './simulation'
import type { ComponentType, LabNode, Wire } from './types'
import { validate } from './validation'

const wire = (id: string, an: string, at: string, bn: string, bt: string, gauge = 16): Wire => ({ id, a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: String(gauge) })
const node = (id: string, type: ComponentType, specs: Partial<Record<string, number>> = {}): LabNode => {
  const n = makeNode(type, 0, 0, id)
  return { ...n, specs: { ...n.specs, ...specs } as Record<string, number> }
}
const rules = (nodes: LabNode[], wires: Wire[]) => validate(nodes, wires).issues.map((i) => i.rule)
const at = (h: number, extra: Partial<SimState> = {}): SimState => ({ ...freshSim(), t: h * 60, ...extra })
/** Sample off-grid system with some nodes' specs changed. */
const sample = (edits: Record<string, Partial<Record<string, number>>> = {}, swap: Record<string, ComponentType> = {}) => {
  const { nodes, wires } = sampleProject()
  return {
    nodes: nodes.map((n) => {
      const t = swap[n.id] ? { ...makeNode(swap[n.id], n.x, n.y, n.id) } : n
      return edits[n.id] ? { ...t, specs: { ...t.specs, ...edits[n.id] } as Record<string, number> } : t
    }),
    wires,
  }
}
/** Two 12 V batteries of `a` and `b` in series on an MPPT controller. */
const pair = (a: ComponentType, b: ComponentType) => {
  const nodes = [node('cc1', 'mppt'), node('b1', a), node('b2', b)]
  const wires = [wire('1', 'cc1', 'bp', 'b1', 'p'), wire('2', 'b1', 'n', 'b2', 'p'), wire('3', 'b2', 'n', 'cc1', 'bn')]
  return { nodes, wires }
}

describe('battery chemistries (PRD §4.1D, §6.3)', () => {
  it('every battery type has a chemistry, and bat stays LiFePO4', () => {
    for (const t of BATTERY_TYPES) expect(CHEM_OF[t]).toBeDefined()
    expect(chemistryOf({ type: 'bat' }).id).toBe('lfp')
    expect(new Set(BATTERY_TYPES.map((t) => CHEM_OF[t])).size).toBe(5)
  })

  it('OCV curves rise with SOC and invert', () => {
    for (const c of Object.values(CHEMISTRIES)) {
      for (let s = 0; s < 100; s += 5) expect(cellOcv(c, s + 5)).toBeGreaterThan(cellOcv(c, s))
      for (const s of [3, 27, 64, 98]) expect(socAtCellV(c, cellOcv(c, s))).toBeCloseTo(s, 5)
    }
    expect(bankOcv(CHEMISTRIES.lfp, 25.6, 50)).toBeCloseTo(8 * 3.27)
    expect(bankSocAt(CHEMISTRIES.agm, 24, bankOcv(CHEMISTRIES.agm, 24, 50))).toBeCloseTo(50)
  })

  it('lead-acid is less efficient and has a deeper minimum than lithium', () => {
    expect(CHEMISTRIES.fla.chargeEff).toBeLessThan(CHEMISTRIES.lfp.chargeEff)
    expect(CHEMISTRIES.agm.minSoc).toBeGreaterThan(CHEMISTRIES.lfp.minSoc)
    expect(CHEMISTRIES.gel.absorbV).toBeLessThan(CHEMISTRIES.agm.absorbV)
    expect(CHEMISTRIES.fla.bms).toBe(false)
    expect(CHEMISTRIES.nmc.bms).toBe(true)
  })

  it('two 12 V AGM batteries make a valid 24 V bank', () => {
    const { nodes, wires } = pair('batagm', 'batagm')
    const v = validate(nodes, wires)
    expect(v.sys.bank?.nomV).toBe(24)
    expect(v.issues.map((i) => i.rule)).not.toContain('POL-001')
    expect(v.issues.map((i) => i.rule)).not.toContain('BAT-003')
  })

  it('flags lithium mixed with lead-acid (BAT-003, critical) and mixed lead-acid types (BAT-002)', () => {
    const lfpAgm = pair('batagm', 'bat')
    lfpAgm.nodes[2] = { ...lfpAgm.nodes[2], specs: { ...lfpAgm.nodes[2].specs, nomV: 12.8 } }
    const v = validate(lfpAgm.nodes, lfpAgm.wires)
    expect(v.issues.find((i) => i.rule === 'BAT-003')?.sev).toBe('critical')
    const { nodes, wires } = pair('batagm', 'batgel')
    const r = rules(nodes, wires)
    expect(r).toContain('BAT-002')
    expect(r).not.toContain('BAT-003')
  })

  it('every chemistry works in the off-grid sample: validation, simulation and measurements', () => {
    for (const t of BATTERY_TYPES) {
      const chem = chemistryOf({ type: t })
      // Enough series batteries for a 24 V system.
      const nomV = CATALOG[t].specs.find((s) => s[0] === 'nomV')![3]
      const count = Math.round(24 / nomV) || 1
      const { nodes, wires } = sampleProject()
      const extra = Array.from({ length: count }, (_, i) => node(`x${i}`, t))
      const ws = wires.filter((w) => w.a.n !== 'bat1' && w.b.n !== 'bat1')
      const top = 'x0'
      const bottom = `x${count - 1}`
      const series = extra.slice(1).map((b, i) => wire(`s${i}`, extra[i].id, 'n', b.id, 'p', 50))
      const all = [...nodes.filter((n) => n.id !== 'bat1'), ...extra]
      const allW = [...ws, ...series, wire('c1', 'cc1', 'bp', top, 'p'), wire('c2', 'cc1', 'bn', bottom, 'n'), wire('d1', top, 'p', 'dcb1', 'i', 25), wire('d2', bottom, 'n', 'inv1', 'dn', 50)]
      const v = validate(all, allW)
      expect(v.sys.bank?.members.length, t).toBe(count)
      expect(v.sys.invOk, t).toBe(true)
      const m = compute(at(12), v, 85)
      expect(m.chem.id).toBe(chem.id)
      expect(m.vbat).toBeCloseTo(bankOcv(chem, v.sys.bank!.nomV, 62))
      const r = measureNode(extra[0], at(12), m, v, [])
      expect(r.find((x) => x.label === 'Chemistry')?.value).toBe(chem.label)
      expect(FAULT_DEFS['bms-cutoff'].appliesTo).toContain(t)
    }
  })
})

describe('battery runtime limits (PRD §6.3)', () => {
  it('caps charging at the bank maximum and logs it', () => {
    const { nodes, wires } = sample({ bat1: { maxC: 5 } })
    const v = validate(nodes, wires)
    const m = compute(at(12), v, 100)
    expect(m.chargeLimited).toBe(true)
    expect(m.pbat).toBeLessThanOrEqual(5 * m.vbat + 1e-6)
    const r = step(at(12, { started: true }), v, 100, 0, nodes)
    expect(r.logs.some((l) => /Charge current limited/.test(l.text))).toBe(true)
  })

  it('stores less energy in lead-acid for the same charging power (charge efficiency)', () => {
    const gain = (type: ComponentType, nomV: number) => {
      const { nodes, wires } = sample({ bat1: { nomV, ah: 200, maxC: 100, maxD: 150 } }, { bat1: type })
      const v = validate(nodes, wires)
      const s0 = at(12, { soc: 50, lastLoads: '' })
      const m = compute(s0, v, 100)
      const s1 = step(s0, v, 100, 0, nodes).sim
      return (s1.soc - 50) / m.pbat
    }
    expect(gain('batagm', 25.6)).toBeLessThan(gain('bat', 25.6))
  })

  it('BMS over-current: loads beyond the bank discharge limit switch the inverter off', () => {
    const { nodes, wires } = sample({ bat1: { maxD: 5 } })
    const v = validate(nodes, wires)
    const m = compute(at(20), v, 85)
    expect(m.ac.bmsOvercurrent).toBe(true)
    expect(m.invOn).toBe(false)
    const r = step(at(20), v, 85, 0, nodes)
    expect(r.logs.some((l) => /BMS over-current/.test(l.text))).toBe(true)
  })

  it('lithium BMS cuts discharge at its minimum when the inverter LVD is set too low', () => {
    const { nodes, wires } = sample({ inv1: { lvd: 20, lvr: 21 } })
    const v = validate(nodes, wires)
    expect(v.issues.map((i) => i.rule)).toContain('BAT-004')
    const r = step(at(21, { soc: 5.01 }), v, 85, 0, nodes)
    expect(r.sim.bmsLow).toBe(true)
    expect(r.logs.some((l) => /BMS low-voltage cut-off/.test(l.text))).toBe(true)
    const m = compute(r.sim, v, 85)
    expect(m.invOn).toBe(false)
  })

  it('lead-acid has no BMS but warns about deep discharge', () => {
    const { nodes, wires } = sample({ bat1: { nomV: 24 }, inv1: { lvd: 22, lvr: 24.5 } }, { bat1: 'batagm' })
    const v = validate(nodes, wires)
    const r = step(at(21, { soc: 49.9 }), v, 85, 0, nodes)
    expect(r.sim.bmsLow).toBeFalsy()
    expect(r.logs.some((l) => /Deep discharge/.test(l.text))).toBe(true)
  })
})

describe('PV variants and model (PRD §4.1A, §6.2)', () => {
  it('every PV type forms strings, takes faults and sits on the roof', () => {
    for (const t of PV_TYPES) {
      const nodes = [node('p1', t), node('p2', t), node('cc1', 'mppt', { maxPvV: 250 }), node('b1', 'bat')]
      const wires = [wire('1', 'p1', 'p', 'cc1', 'pvp', 6), wire('2', 'p1', 'n', 'p2', 'p', 6), wire('3', 'p2', 'n', 'cc1', 'pvn', 6), wire('4', 'cc1', 'bp', 'b1', 'p'), wire('5', 'cc1', 'bn', 'b1', 'n')]
      const v = validate(nodes, wires)
      expect(v.sys.strings.map((s) => s.length), t).toEqual([2])
      expect(FAULT_DEFS['module-open'].appliesTo).toContain(t)
      const l = layout3d(nodes, 'rooftop')
      expect(l.placements.p1.position[1]).toBeGreaterThan(2)
    }
  })

  it('PV variants carry their own example specs', () => {
    const power = (t: ComponentType) => makeNode(t, 0, 0).specs.ratedPower
    expect(new Set(PV_TYPES.map(power)).size).toBe(PV_TYPES.length)
    expect(makeNode('pvbif', 0, 0).specs.bifi).toBeGreaterThan(0)
  })

  it('hot cells produce less, cold cells raise Voc', () => {
    const p = makeNode('pv', 0, 0)
    expect(coldVoc(p)).toBeGreaterThan(p.specs.voc)
    expect(coldVoc(p)).toBeCloseTo(p.specs.voc * (1 + (-0.27 / 100) * (DESIGN_MIN_TEMP - 25)))
    const hot = moduleDcPower(p, 1000, 13)
    const noCoeff = moduleDcPower({ ...p, specs: { ...p.specs, tcP: 0 } }, 1000, 13)
    expect(hot).toBeLessThan(noCoeff * 0.9)
  })

  it('orientation: south-facing at a low tilt beats north-facing or vertical; bifacial adds gain', () => {
    const p = makeNode('pv', 0, 0)
    const f = (tilt: number, azimuth: number) => orientationFactor({ ...p, specs: { ...p.specs, tilt, azimuth } })
    expect(f(12, 180)).toBeCloseTo(1)
    expect(f(30, 0)).toBeLessThan(f(30, 180))
    expect(f(90, 180)).toBeLessThan(f(15, 180))
    expect(f(0, 0)).toBeCloseTo(f(0, 180))
    const bif = makeNode('pvbif', 0, 0)
    const plain = { ...bif, specs: { ...bif.specs, bifi: 0 } }
    expect(moduleDcPower(bif, 800, 12) / moduleDcPower(plain, 800, 12)).toBeCloseTo(1.08)
  })

  it('RAT-012 warns about the cold-morning Voc; RAT-001 stays the 25 °C limit', () => {
    const nodes = [node('p1', 'pv'), node('p2', 'pv'), node('p3', 'pv'), node('cc1', 'mppt'), node('b1', 'bat')]
    const wires = [wire('1', 'p1', 'p', 'cc1', 'pvp', 6), wire('2', 'p1', 'n', 'p2', 'p', 6), wire('3', 'p2', 'n', 'p3', 'p', 6), wire('4', 'p3', 'n', 'cc1', 'pvn', 6), wire('5', 'cc1', 'bp', 'b1', 'p'), wire('6', 'cc1', 'bn', 'b1', 'n')]
    const v = validate(nodes, wires)
    expect(v.issues.find((i) => i.rule === 'RAT-012')?.sev).toBe('warning')
    expect(v.issues.map((i) => i.rule)).not.toContain('RAT-001')
    expect(v.sys.ccOk).toBe(true)
  })

  it('reports cell temperature and module output in measurements', () => {
    const { nodes, wires } = sampleProject()
    const v = validate(nodes, wires)
    const m = compute(at(12), v, 85)
    expect(m.tcell).toBeGreaterThan(m.tamb + 20)
    const r = measureNode(nodes[0], at(12), m, v, [])
    expect(r.find((x) => x.label === 'Cell temperature')?.value).toMatch(/°C/)
    expect(m.modulePower.pv1).toBeCloseTo(m.ppv / 2)
  })
})

describe('loads: surge, priority and energy (PRD §6.5)', () => {
  it('every load type has a surge factor and a priority; motors surge about 3×', () => {
    for (const t of ['led', 'fan', 'fridge', 'tv', 'acw', 'acs', 'pc', 'laptop', 'router', 'rice', 'kettle', 'micro', 'induc', 'wash', 'iron', 'pump'] as ComponentType[]) {
      const s = makeNode(t, 0, 0).specs
      expect(s.surge, t).toBeGreaterThanOrEqual(1)
      expect([1, 2, 3], t).toContain(s.priority)
      expect(CATALOG[t].ver).toBe(2)
    }
    for (const t of ['acw', 'fridge', 'pump', 'wash'] as ComponentType[]) expect(makeNode(t, 0, 0).specs.surge).toBe(3)
    expect(makeNode('kettle', 0, 0).specs.surge).toBe(1)
  })

  it('sheds priority 3 before priority 2, larger first, never priority 1', () => {
    const order = loadOrderForShedding([node('a', 'fridge'), node('b', 'tv'), node('c', 'kettle'), node('d', 'micro')]).map((l) => l.id)
    expect(order).toEqual(['c', 'd', 'b'])
  })

  it('refuses a start whose surge exceeds the inverter surge rating', () => {
    const { refused } = surgeRefused([node('a', 'led')], [node('p', 'pump')], 1000)
    expect(refused.map((l) => l.id)).toEqual(['p'])
    expect(surgeRefused([], [node('p', 'pump')], 0).refused).toEqual([])
  })

  it('a motor start above the surge rating is logged and the load stays off until its next start', () => {
    const { nodes, wires } = sample({ inv1: { surgeP: 300 } })
    const v = validate(nodes, wires)
    // The fridge (150 W, 3× surge) starts with the first tick.
    const r = step(at(12), v, 85, 0, nodes)
    expect(r.sim.surgeBlocked).toEqual(['ld2'])
    expect(r.logs.some((l) => /surge overload/.test(l.text))).toBe(true)
    const m = compute(r.sim, v, 85)
    expect(m.ac.blocked.map((l) => l.id)).toEqual(['ld2'])
    expect(m.onLoads.map((l) => l.id)).not.toContain('ld2')
  })

  it('an overloaded inverter sheds non-essential loads instead of tripping', () => {
    const { nodes, wires } = sample({ ld2: { priority: 3, p: 3100, surge: 1, on: 0, off: 24 }, ld1: { on: 0, off: 24 } })
    const v = validate(nodes, wires)
    const m = compute(at(20), v, 85)
    expect(m.overload).toBe(false)
    expect(m.ac.shed).toEqual([{ id: 'ld2', reason: 'overload' }])
    expect(m.onLoads.map((l) => l.id)).toEqual(['ld1'])
  })

  it('a low battery sheds non-essential loads (with hysteresis) and logs it', () => {
    const { nodes, wires } = sample({ ld1: { priority: 3 } })
    const v = validate(nodes, wires)
    const r = step(at(19, { soc: 25 }), v, 85, 0, nodes)
    expect(r.sim.shedLevel).toBe(1)
    const r2 = step(r.sim, v, 85, 0, nodes)
    expect(r2.logs.some((l) => /Load shedding: LED Lighting/.test(l.text))).toBe(true)
    expect(compute(r2.sim, v, 85).ac.shed).toEqual([{ id: 'ld1', reason: 'battery' }])
    // Stays shed just above the threshold; restored 5% above it.
    expect(step({ ...r2.sim, soc: 31 }, v, 85, 0, nodes).sim.shedLevel).toBe(1)
    expect(step({ ...r2.sim, soc: 36 }, v, 85, 0, nodes).sim.shedLevel).toBe(0)
  })

  it('tracks energy per load and shows it in measurements', () => {
    const { nodes, wires } = sampleProject()
    let sim = at(19)
    const v = validate(nodes, wires)
    for (let i = 0; i < 30; i++) sim = step(sim, v, 85, 0, nodes).sim
    // LED 60 W for one hour.
    expect(sim.loadKwh?.ld1).toBeCloseTo(0.06, 3)
    const r = measureNode(nodes.find((n) => n.id === 'ld1')!, sim, compute(sim, v, 85), v, [])
    expect(r.find((x) => x.label === 'Energy used')?.value).toBe('0.06 kWh')
  })
})

describe('inverter (PRD §6.4)', () => {
  it('reports its AC frequency (60 Hz)', () => {
    const { nodes, wires } = sampleProject()
    const v = validate(nodes, wires)
    const m = compute(at(20), v, 85)
    expect(m.freq).toBe(60)
    expect(measureNode(nodes.find((n) => n.id === 'inv1')!, at(20), m, v, []).find((r) => r.label === 'AC frequency')?.value).toBe('60 Hz')
  })

  it('disconnects at its low-voltage setting and reconnects with hysteresis', () => {
    const { nodes, wires } = sampleProject()
    const v = validate(nodes, wires)
    const socAtLvd = bankSocAt(CHEMISTRIES.lfp, 25.6, 25)
    expect(socAtLvd).toBeGreaterThan(10)
    expect(socAtLvd).toBeLessThan(12)
    let r = step(at(21, { soc: socAtLvd - 0.01 }), v, 85, 0, nodes)
    expect(r.sim.lvd).toBe(true)
    expect(r.logs.some((l) => /disconnect setting 25 V/.test(l.text))).toBe(true)
    r = step({ ...r.sim, soc: 15 }, v, 85, 0, nodes)
    expect(r.sim.lvd).toBe(true)
    r = step({ ...r.sim, soc: 20.5 }, v, 85, 0, nodes)
    expect(r.sim.lvd).toBe(false)
  })

  it('checks the DC input range (RAT-013) and the LVD setting for the chemistry (BAT-004)', () => {
    expect(rules(...Object.values(sample({ inv1: { maxDcV: 27 } })) as [LabNode[], Wire[]])).toContain('RAT-013')
    expect(rules(...Object.values(sampleProject()) as [LabNode[], Wire[]])).not.toContain('RAT-013')
    // A 24 V AGM bank with the LiFePO4 default of 25 V shuts down at about 75 %.
    const agm = sample({ bat1: { nomV: 24 } }, { bat1: 'batagm' })
    const v = validate(agm.nodes, agm.wires)
    expect(v.issues.find((i) => i.rule === 'BAT-004')?.msg).toMatch(/shuts the inverter down/)
    expect(v.issues.find((i) => i.rule === 'BAT-004')?.fix).toMatch(/24\.5 V/)
  })

  it('trips on sustained overload after a deterministic 30 minutes', () => {
    const { nodes, wires } = sample({ ld2: { p: 3400, surge: 1, on: 0, off: 24 } })
    const v = validate(nodes, wires)
    let sim = at(12, { soc: 90 })
    let tripped = false
    const logs: string[] = []
    for (let i = 0; i < 20 && !tripped; i++) {
      const r = step(sim, v, 85, 0, nodes)
      sim = r.sim
      logs.push(...r.logs.map((l) => l.text))
      tripped = sim.thermalUntil !== undefined
    }
    expect(tripped).toBe(true)
    expect(logs.some((l) => /thermal protection/.test(l))).toBe(true)
    expect(compute(sim, v, 85).thermalTrip).toBe(true)
    expect(compute(sim, v, 85).invOn).toBe(false)
    expect(simulateDays(nodes, wires, 1).thermal).toBe(true)
  })
})

describe('rule registry and ordered stages (PRD §7.3, rule 5)', () => {
  it('every rule carries a corrective action and a stage', () => {
    for (const r of Object.values(RULES)) {
      expect(r.fix, r.id).toMatch(/\w/)
      expect(STAGE_ORDER[r.stage], r.id).toBeGreaterThan(0)
    }
    expect(fixFor({ rule: 'BND-001', fix: '' })).toBe(RULES['BND-001'].fix)
    expect(fixFor({ rule: 'BND-001', fix: 'Own fix.' })).toBe('Own fix.')
  })

  it('issues carry their stage and are ordered by severity, then stage', () => {
    const { nodes, wires } = sample({ bat1: { nomV: 51.2 } })
    const bad = wires.concat([wire('x', 'db1', 'l1', 'db1', 'n1', 2.5)])
    const v = validate(nodes.concat([node('pvx', 'pv')]), bad)
    const key = (i: { sev: string; stage?: number }) => ({ critical: 0, warning: 1, info: 2 })[i.sev]! * 10 + i.stage!
    for (let i = 1; i < v.issues.length; i++) expect(key(v.issues[i])).toBeGreaterThanOrEqual(key(v.issues[i - 1]))
    expect(v.stages.map((s) => s.name)).toEqual(['Terminal', 'AC/DC domain', 'Polarity', 'Ratings', 'Topology', 'Protection'])
    expect(v.stages[0].status).toBe('fail')
    expect(validate(nodes, bad).issues).toEqual(validate(nodes, bad).issues)
  })
})

describe('short circuits, coordination and bonding (PRD §5.2, §7.2)', () => {
  it('detects a battery ring (series chain closed on itself) as a DC short', () => {
    const nodes = [node('b1', 'bat'), node('b2', 'bat')]
    const wires = [wire('1', 'b1', 'n', 'b2', 'p'), wire('2', 'b2', 'n', 'b1', 'p')]
    const v = validate(nodes, wires)
    expect(v.issues.find((i) => i.rule === 'SHC-001')?.sev).toBe('critical')
  })

  it('detects + and − of a bank joined through the controller terminals or a DC breaker', () => {
    const { nodes, wires } = sampleProject()
    expect(rules(nodes, wires)).not.toContain('SHC-001')
    expect(rules(nodes, wires.concat([wire('x', 'cc1', 'bn', 'dcb1', 'o', 25)]))).toContain('SHC-001')
    // Parallel batteries are not a short.
    const par = [node('b1', 'bat'), node('b2', 'bat')]
    expect(rules(par, [wire('1', 'b1', 'p', 'b2', 'p'), wire('2', 'b1', 'n', 'b2', 'n')])).not.toContain('SHC-001')
  })

  it('PRT-005: a breaker rated above its cable; PRT-006: below the load current', () => {
    const { nodes, wires } = sampleProject()
    const thin = wires.map((w) => (w.id === 'w6' ? { ...w, gauge: '10' } : w))
    expect(rules(nodes, thin)).toContain('PRT-005')
    expect(rules(nodes, wires)).not.toContain('PRT-005')
    const small = sample({ dcb1: { ratedI: 5 } })
    expect(rules(small.nodes, small.wires)).toContain('PRT-006')
    expect(rules(nodes, wires)).not.toContain('PRT-006')
  })

  it('BND-001: PV frames, controllers and battery enclosures must be bonded to earth', () => {
    const { nodes, wires } = sampleProject()
    expect(rules(nodes, wires)).not.toContain('BND-001')
    const unbonded = wires.filter((w) => !(w.a.n === 'pv1' && w.a.t === 'pe'))
    const v = validate(nodes, unbonded)
    expect(v.issues.filter((i) => i.rule === 'BND-001').map((i) => i.target.node)).toEqual(['pv1'])
    // Lead-acid monoblocs and flexible panels have no PE terminal.
    expect(CATALOG.batagm.L.concat(CATALOG.batagm.R).some((t) => t[2] === 'pe')).toBe(false)
    expect(CATALOG.pvflex.L.concat(CATALOG.pvflex.R).some((t) => t[2] === 'pe')).toBe(false)
  })

  it('new terminals do not break saved wiring: an old project still validates and simulates', () => {
    const { nodes, wires } = sampleProject()
    const old = wires.filter((w) => w.a.t !== 'pe' || w.a.n === 'db1')
    const v = validate(nodes, old)
    expect(v.sys.ok && v.sys.invOk).toBe(true)
    expect(v.issues.filter((i) => i.sev === 'critical')).toEqual([])
  })
})

describe('profiles and catalog files with the new specs', () => {
  it('real profiles mark unpublished new specs as missing (0) and installer settings as settings', () => {
    const jinko = PROFILES.find((p) => p.id === 'pv-jinko-jkm580n-72hl4-bdv')!
    expect(jinko.specs.tcP).toBe(0)
    expect(jinko.missing).toEqual(expect.arrayContaining(['tcP', 'tcVoc', 'noct']))
    expect(jinko.settings).toEqual(expect.arrayContaining(['tilt', 'azimuth']))
    const victron = PROFILES.find((p) => p.id === 'inv-victron-multiplus-ii-24-3000')!
    expect(victron.specs.surgeP).toBe(5500)
    expect(victron.settings).toContain('freq')
  })

  it('accepts older catalog files without the new keys, and negative temperature coefficients', () => {
    const base = { type: 'pv', brand: 'Acme', model: 'AC-500', specs: { ratedPower: 500, voc: 45.1, vmp: 37.8, isc: 13.9 }, datasheet: { url: 'https://acme.example/a.pdf', revision: 'A' } }
    const old = parseCatalog(JSON.stringify({ format: 'solarsketch-catalog', version: 1, name: 'Old', profiles: [base] }))
    expect(old.profiles[0].specs).toMatchObject({ tcP: 0, tilt: 10 })
    expect(old.profiles[0].missing).toContain('tcP')
    const signed = parseCatalog(JSON.stringify({ format: 'solarsketch-catalog', version: 1, name: 'New', profiles: [{ ...base, specs: { ...base.specs, tcP: -0.29, tcVoc: -0.25 } }] }))
    expect(signed.profiles[0].specs.tcP).toBe(-0.29)
  })
})
