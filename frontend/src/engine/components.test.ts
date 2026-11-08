/**
 * PRD §4.1 hardware categories added as electrically modelled components: connectors, combiner,
 * DC/AC protection, SPDs, busbars, meters and the microinverter.
 */
import { describe, expect, it } from 'vitest'

import { CATALOG, makeNode } from './catalog'
import type { Fault } from './faults'
import { wireFlows } from './flows'
import { RULES } from './rules'
import { compute, freshSim, step, type SimState } from './simulation'
import type { ComponentType, LabNode, Wire } from './types'
import { validate } from './validation'

const at = (h: number, extra: Partial<SimState> = {}): SimState => ({ ...freshSim(), t: h * 60, started: true, ...extra })
const node = (type: ComponentType, id: string, specs: Record<string, number> = {}): LabNode => {
  const n = makeNode(type, 0, 0, id)
  return { ...n, specs: { ...n.specs, ...specs } }
}
const wiresOf = (links: [string, string, string, string, number?][]): Wire[] =>
  links.map(([an, at, bn, bt, g], i) => ({ id: 'w' + (i + 1), a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: String(g ?? 10) }))
const rules = (v: ReturnType<typeof validate>, id?: string) => v.issues.filter((i) => !id || i.target.node === id).map((i) => i.rule)
const NEW_TYPES: ComponentType[] = ['mc4', 'ybr', 'cbx', 'fuse', 'iso', 'dspd', 'mcb', 'mccb', 'rccb', 'aspd', 'acsw', 'dbus', 'pebar', 'dcm', 'acm', 'mi']

/** Off-grid system: PV → MPPT; battery → fuse → isolator → inverter; DC− through a shunt meter. */
function offGrid(fuse: Record<string, number> = {}, iso: Record<string, number> = {}) {
  const nodes = [
    node('pv', 'pv1'),
    node('pv', 'pv2'),
    node('mppt', 'cc1'),
    node('bat', 'bat1'),
    node('fuse', 'fu1', fuse),
    node('iso', 'iso1', iso),
    node('dcm', 'dcm1'),
    node('inv', 'inv1'),
    node('acdb', 'db1'),
    node('led', 'ld1'),
    node('gnd', 'g1'),
  ]
  const wires = wiresOf([
    ['pv1', 'p', 'cc1', 'pvp', 6],
    ['pv1', 'n', 'pv2', 'p', 6],
    ['pv2', 'n', 'cc1', 'pvn', 6],
    ['bat1', 'p', 'fu1', 'i', 50],
    ['fu1', 'o', 'iso1', 'ip', 50],
    ['fu1', 'o', 'cc1', 'bp', 16],
    ['iso1', 'op', 'inv1', 'dp', 50],
    ['bat1', 'n', 'dcm1', 'bn', 50],
    ['dcm1', 'ln', 'iso1', 'in', 50],
    ['dcm1', 'ln', 'cc1', 'bn', 16],
    ['dcm1', 'vp', 'bat1', 'p', 2.5],
    ['iso1', 'on', 'inv1', 'dn', 50],
    ['inv1', 'l', 'db1', 'l', 4],
    ['inv1', 'n', 'db1', 'n', 4],
    ['inv1', 'pe', 'g1', 'pe', 6],
    ['db1', 'pe', 'g1', 'pe', 6],
    ['db1', 'l1', 'ld1', 'l', 2.5],
    ['db1', 'n1', 'ld1', 'n', 2.5],
  ])
  return { nodes, wires }
}

describe('component data model (PRD §4.2)', () => {
  it('gives every catalog type a description, maker, constraints, symbol, 3D model and configurations', () => {
    for (const [id, c] of Object.entries(CATALOG)) {
      expect(c.desc, id).toMatch(/\w+.*\.$/)
      expect(c.maker, id).toBeTruthy()
      expect(Array.isArray(c.constraints), id).toBe(true)
      expect(c.symbol && c.model3d, id).toBeTruthy()
      expect(c.configs.length, id).toBeGreaterThan(0)
    }
  })

  it('marks the new generic parts as example data, not a real brand', () => {
    for (const k of NEW_TYPES) expect(CATALOG[k].maker).toBe('Generic (example)')
  })

  it('registers every rule id the inline-device checks can emit', async () => {
    const src = await import('./inline.ts?raw').then((m) => m.default as string)
    const used = new Set(src.match(/'(TRM|DOM|POL|RAT|BAT|TOP|PRT|GND|INF|AC|NM)-\d{3}'/g)!.map((s) => s.slice(1, -1)))
    expect([...used].filter((id) => !RULES[id])).toEqual([])
  })
})

describe('DC isolator, fuse and shunt meter', () => {
  it('conducts through the fuse and closed isolator; the fuse counts as battery protection', () => {
    const { nodes, wires } = offGrid()
    const v = validate(nodes, wires)
    expect(v.sys.invOk).toBe(true)
    expect(v.sys.ok).toBe(true)
    expect(v.sys.invBreaker?.id).toBe('fu1')
    expect(rules(v)).not.toContain('PRT-001')
    expect(rules(v)).not.toContain('TOP-003')
    expect(compute(at(21), v, 85).onLoads.map((l) => l.id)).toEqual(['ld1'])
  })

  it('an open isolator breaks the circuit: no supply and no current through it', () => {
    const { nodes, wires } = offGrid({}, { closed: 0 })
    const v = validate(nodes, wires)
    expect(rules(v, 'iso1')).toContain('INF-010')
    expect(rules(v, 'inv1')).toContain('TOP-003')
    expect(v.sys.invOk).toBe(false)
    const m = compute(at(21), v, 85)
    expect(m.onLoads).toEqual([])
    const flows = wireFlows(nodes, wires, v, m, at(21).t)
    const isoOut = wires.find((w) => w.a.n === 'iso1' && w.a.t === 'op')!
    expect(flows[isoOut.id]).toBeUndefined()
  })

  it('flags a fuse rated below the circuit current', () => {
    const v = validate(...Object.values(offGrid({ ratedI: 50 })) as [LabNode[], Wire[]])
    expect(rules(v, 'fu1')).toContain('PRT-010')
    expect(rules(validate(...Object.values(offGrid()) as [LabNode[], Wire[]]), 'fu1')).not.toContain('PRT-010')
  })

  it('a blown fuse cuts the inverter’s DC supply', () => {
    const { nodes, wires } = offGrid()
    const v = validate(nodes, wires)
    const blown: Fault = { id: 'f', kind: 'fuse-blown', target: 'fu1' }
    const m = compute(at(21), v, 85, [blown])
    expect(m.dcOff).toBe(true)
    expect(m.onLoads).toEqual([])
  })

  it('the shunt meter reads the battery discharge at night and charge at noon', () => {
    const { nodes, wires } = offGrid()
    const v = validate(nodes, wires)
    const night = compute(at(21), v, 85)
    const r = night.meters['dcm1']
    expect(r.v).toBeCloseTo(night.vbat)
    expect(r.a).toBeGreaterThan(0)
    expect(r.w).toBeCloseTo(night.pinv - night.cc, 0)
    const noon = compute(at(12), v, 85)
    expect(noon.meters['dcm1'].w).toBeLessThan(0)
    // Energy accumulates in the simulation state.
    const s = step(at(21), v, 85, 0, nodes).sim
    expect(s.meterWh?.['dcm1']).toBeGreaterThan(0)
  })

  it('reads no voltage without the V+ sense wire', () => {
    const { nodes, wires } = offGrid()
    const v = validate(nodes, wires.filter((w) => !(w.a.n === 'dcm1' && w.a.t === 'vp')))
    expect(compute(at(21), v, 85).meters['dcm1'].v).toBe(0)
  })
})

describe('surge protective devices', () => {
  const base = () => {
    const { nodes, wires } = offGrid()
    return { nodes: [...nodes, node('dspd', 'spd1')], wires: [...wires, ...wiresOf([['spd1', 'p', 'cc1', 'pvp', 4], ['spd1', 'n', 'cc1', 'pvn', 4]]).map((w) => ({ ...w, id: 's' + w.id }))] }
  }

  it('reports a PV input without a DC SPD (information)', () => {
    const v = validate(...Object.values(offGrid()) as [LabNode[], Wire[]])
    const i = v.issues.find((x) => x.rule === 'PRT-012')
    expect(i?.sev).toBe('info')
    expect(i?.target.node).toBe('cc1')
  })

  it('requires the SPD to be earthed', () => {
    const { nodes, wires } = base()
    const v = validate(nodes, wires)
    expect(rules(v)).not.toContain('PRT-012')
    expect(rules(v, 'spd1')).toContain('GND-010')
    const earthed = validate(nodes, [...wires, { id: 'spe', a: { n: 'spd1', t: 'pe' }, b: { n: 'g1', t: 'pe' }, color: 'gy', gauge: '6' }])
    expect(rules(earthed, 'spd1')).not.toContain('GND-010')
  })

  it('reaches earth through an earth busbar', () => {
    const { nodes, wires } = base()
    const v = validate([...nodes, node('pebar', 'eb1')], [...wires, ...wiresOf([['spd1', 'pe', 'eb1', 'e1', 6], ['eb1', 'e6', 'g1', 'pe', 6]]).map((w) => ({ ...w, id: 'e' + w.id }))])
    expect(rules(v, 'spd1')).not.toContain('GND-010')
  })
})

describe('combiner box and Y-branch', () => {
  const combined = (type: 'cbx' | 'ybr', specs: Record<string, number> = {}, gauge = 6) => {
    const nodes = [node('pv', 'a1'), node('pv', 'a2'), node('pv', 'b1'), node('pv', 'b2'), node(type, 'cx', specs), node('mppt', 'cc1'), node('bat', 'bat1')]
    const [p1, p2, n1, n2, po, no] = type === 'cbx' ? ['p1', 'p2', 'n1', 'n2', 'po', 'no'] : ['p1', 'p2', 'n1', 'n2', 'po', 'no']
    const wires = wiresOf([
      ['a1', 'p', 'cx', p1, 6],
      ['a1', 'n', 'a2', 'p', 6],
      ['a2', 'n', 'cx', n1, 6],
      ['b1', 'p', 'cx', p2, 6],
      ['b1', 'n', 'b2', 'p', 6],
      ['b2', 'n', 'cx', n2, 6],
      ['cx', po, 'cc1', 'pvp', gauge],
      ['cx', no, 'cc1', 'pvn', gauge],
      ['cc1', 'bp', 'bat1', 'p', 16],
      ['cc1', 'bn', 'bat1', 'n', 16],
    ])
    return validate(nodes, wires)
  }

  it('parallels the strings onto the controller', () => {
    for (const type of ['cbx', 'ybr'] as const) {
      const v = combined(type)
      expect(v.sys.strings.length, type).toBe(2)
      expect(v.sys.ok, type).toBe(true)
    }
  })

  it('sizes the output cable for the combined current', () => {
    // Two strings × 10.4 A × 1.25 = 26 A, above 2.5 mm² (24 A).
    const v = combined('ybr', {}, 2.5)
    const out = Object.entries(v.wres).find(([id]) => id === 'w7')![1]
    expect(out.I).toBeCloseTo(26)
    expect(out.fail?.rule).toBe('RAT-004')
  })

  it('checks combiner string fuses against 1.5–2.4 × Isc', () => {
    expect(rules(combined('cbx', { fuseA: 10 }), 'cx')).toContain('PRT-013')
    expect(rules(combined('cbx', { fuseA: 30 }), 'cx')).toContain('PRT-013')
    expect(rules(combined('cbx', { fuseA: 20 }), 'cx')).not.toContain('PRT-013')
  })

  it('checks connector voltage ratings against the string Voc', () => {
    expect(rules(combined('ybr', { maxV: 60 }), 'cx')).toContain('PRT-011')
    expect(rules(combined('ybr'), 'cx')).not.toContain('PRT-011')
  })
})

describe('AC protection', () => {
  /** Inverter → board L1 → MCB → loads; board L2 → RCCB → load. */
  const acSystem = (mcb: Record<string, number> = {}) => {
    const { nodes: base, wires } = offGrid()
    // A 6 kW inverter, so the branch (not the inverter) limits the circuit current.
    const nodes = base.map((n) => (n.id === 'inv1' ? { ...n, specs: { ...n.specs, ratedP: 6000 } } : n))
    const extra = [node('mcb', 'mcb1', mcb), node('kettle', 'k1'), node('iron', 'ir1'), node('induc', 'ic1'), node('rccb', 'rc1'), node('fan', 'fan1')]
    const more = wiresOf([
      ['db1', 'l2', 'mcb1', 'l', 4],
      ['mcb1', 'lo', 'k1', 'l', 4],
      ['mcb1', 'lo', 'ir1', 'l', 4],
      ['mcb1', 'lo', 'ic1', 'l', 4],
      ['db1', 'n2', 'k1', 'n', 4],
      ['db1', 'n2', 'ir1', 'n', 4],
      ['db1', 'n2', 'ic1', 'n', 4],
      ['inv1', 'l', 'rc1', 'l', 4],
      ['inv1', 'n', 'rc1', 'n', 4],
      ['rc1', 'lo', 'fan1', 'l', 2.5],
      ['rc1', 'no', 'fan1', 'n', 2.5],
    ]).map((w) => ({ ...w, id: 'ac' + w.id }))
    return { nodes: [...nodes, ...extra], wires: [...wires, ...more] }
  }

  it('flags an MCB rated below its branch load', () => {
    // 1500 + 1000 + 1800 W on one circuit ≈ 18.7 A.
    const { nodes, wires } = acSystem({ ratedI: 16 })
    expect(rules(validate(nodes, wires), 'mcb1')).toContain('PRT-010')
    const ok = acSystem({ ratedI: 20 })
    expect(rules(validate(ok.nodes, ok.wires), 'mcb1')).not.toContain('PRT-010')
  })

  it('an open MCB de-energises its circuit', () => {
    const { nodes, wires } = acSystem({ closed: 0 })
    const v = validate(nodes, wires)
    expect(v.sys.acSupplied.map((l) => l.id)).not.toContain('k1')
    expect(rules(v, 'k1')).toContain('INF-002')
    expect(v.sys.boardOf['k1']).toBeUndefined()
  })

  it('a tripped AC breaker de-energises its circuit at run time', () => {
    const { nodes, wires } = acSystem({ ratedI: 25 })
    const v = validate(nodes, wires)
    const trip: Fault = { id: 't', kind: 'ac-breaker-trip', target: 'mcb1' }
    // The kettle runs at 06:00 from the battery.
    expect(compute(at(6.1), v, 0).onLoads.map((l) => l.id)).toContain('k1')
    expect(compute(at(6.1), v, 0, [trip]).onLoads.map((l) => l.id)).not.toContain('k1')
  })

  it('loads behind an MCB keep their board RCD; a standalone RCCB protects its own loads', () => {
    const { nodes, wires } = acSystem({ ratedI: 25 })
    const v = validate(nodes, wires)
    expect(v.sys.boardOf['k1']).toBe('db1')
    expect(v.sys.boardOf['fan1']).toBe('rc1')
  })

  it('earth leakage trips the standalone RCCB and switches off its loads', () => {
    const { nodes, wires } = acSystem({ ratedI: 25 })
    const v = validate(nodes, wires)
    const leak: Fault = { id: 'g', kind: 'ground-fault', target: 'fan1' }
    const { sim, logs } = step(at(12), v, 85, 0, nodes, [leak])
    expect(sim.rcdTripped).toContain('rc1')
    expect(logs.some((l) => l.text.startsWith('RCCB tripped'))).toBe(true)
    expect(compute(sim, v, 85, [leak]).rcdOff.map((l) => l.id)).toContain('fan1')
  })

  it('an open AC disconnect cuts a grid-fed load', () => {
    const build = (closed: number) => {
      const nodes = [node('grid', 'gr1'), node('acsw', 'sw1', { closed }), node('fridge', 'f1')]
      const wires = wiresOf([
        ['gr1', 'l', 'sw1', 'l', 4],
        ['gr1', 'n', 'sw1', 'n', 4],
        ['sw1', 'lo', 'f1', 'l', 2.5],
        ['sw1', 'no', 'f1', 'n', 2.5],
      ])
      return validate(nodes, wires)
    }
    expect(build(1).sys.acSupplied.map((l) => l.id)).toEqual(['f1'])
    expect(build(0).sys.acSupplied).toEqual([])
  })
})

describe('microinverters and the AC energy meter', () => {
  const micros = () => {
    const nodes = [node('pv', 'pv1'), node('pv', 'pv2'), node('mi', 'mi1'), node('mi', 'mi2'), node('acm', 'm1'), node('nm', 'nm1'), node('grid', 'gr1'), node('gnd', 'g1')]
    const wires = wiresOf([
      ['pv1', 'p', 'mi1', 'pvp', 4],
      ['pv1', 'n', 'mi1', 'pvn', 4],
      ['pv2', 'p', 'mi2', 'pvp', 4],
      ['pv2', 'n', 'mi2', 'pvn', 4],
      // AC daisy chain: mi2 → mi1 → meter → net meter → grid.
      ['mi2', 'l', 'mi1', 'lo', 4],
      ['mi2', 'n', 'mi1', 'no', 4],
      ['mi1', 'l', 'm1', 'lo', 4],
      ['mi1', 'n', 'm1', 'no', 4],
      ['m1', 'l', 'nm1', 'l', 16],
      ['m1', 'n', 'nm1', 'n', 16],
      ['nm1', 'gl', 'gr1', 'l', 16],
      ['nm1', 'gn', 'gr1', 'n', 16],
      ['mi1', 'pe', 'g1', 'pe', 6],
      ['mi2', 'pe', 'g1', 'pe', 6],
    ])
    return { nodes, wires }
  }

  it('validates as two one-module grid-tied inverters sharing a branch', () => {
    const { nodes, wires } = micros()
    const v = validate(nodes, wires)
    expect(v.issues.filter((i) => i.sev === 'critical')).toEqual([])
    for (const id of ['mi1', 'mi2']) expect(rules(v, id).filter((r) => r !== 'INF-001')).toEqual([])
    expect(v.sys.ac.gtis.map((g) => g.node.id).sort()).toEqual(['mi1', 'mi2'])
    expect(v.sys.ac.gtis.every((g) => g.strings.length === 1 && g.strings[0].length === 1)).toBe(true)
  })

  it('rejects a second module in series (input voltage)', () => {
    const { nodes, wires } = micros()
    const series = wires.map((w) => (w.a.n === 'pv1' && w.a.t === 'n' ? { ...w, b: { n: 'pv2', t: 'p' } } : w.a.n === 'pv2' && w.a.t === 'p' ? { ...w, b: { n: 'pv3', t: 'n' } } : w))
    const v = validate(nodes, [...series.filter((w) => w.b.n !== 'pv3'), { id: 'x', a: { n: 'pv2', t: 'n' }, b: { n: 'mi1', t: 'pvn' }, color: 'auto', gauge: '4' }])
    expect(rules(v, 'mi1')).toContain('RAT-001')
  })

  it('exports to the grid at noon; the energy meter reads the export', () => {
    const { nodes, wires } = micros()
    const v = validate(nodes, wires)
    const m = compute(at(12), v, 85)
    expect(m.ac.gtiAc).toBeGreaterThan(400)
    expect(m.ac.gtiAc).toBeLessThanOrEqual(2 * 380 + 1e-6)
    expect(m.ac.pgrid).toBeCloseTo(-m.ac.gtiAc)
    const r = m.meters['m1']
    expect(r.v).toBe(230)
    // Export flows back through the meter (towards its supply side), so the reading is negative.
    expect(r.w).toBeCloseTo(-m.ac.gtiAc, 0)
  })

  it('stops in a grid outage (anti-islanding) and the meter reads 0 V', () => {
    const { nodes, wires } = micros()
    const v = validate(nodes, wires)
    const m = compute(at(12), v, 85, [{ id: 'o', kind: 'grid-outage', target: 'gr1' }])
    expect(m.ac.gtiAc).toBe(0)
    expect(m.meters['m1'].v).toBe(0)
  })
})
