import { describe, expect, it } from 'vitest'

import { sampleProject } from './sample-project'
import { simulateDays } from './scenario'
import { ambientTemp, orientationFactor, PERFORMANCE_FACTOR } from './pv-model'
import { compute, freshSim } from './simulation'
import type { Wire } from './types'
import { validate } from './validation'

describe('validation', () => {
  it('the sample system has no critical findings and a 2S string', () => {
    const { nodes, wires } = sampleProject()
    const v = validate(nodes, wires)
    expect(v.issues.filter((i) => i.sev === 'critical')).toEqual([])
    expect(v.sys.strings.map((s) => s.length)).toEqual([2])
  })

  it('detects reversed DC polarity', () => {
    const { nodes, wires } = sampleProject()
    const swapped: Wire[] = wires.map((w) => (w.id === 'w4' ? { ...w, b: { n: 'bat1', t: 'n' } } : w))
    expect(validate(nodes, swapped).issues.some((i) => i.rule === 'POL-001')).toBe(true)
  })

  it('detects DC connected to AC', () => {
    const { nodes, wires } = sampleProject()
    const bad = wires.concat([{ id: 'x', a: { n: 'bat1', t: 'p' }, b: { n: 'ld1', t: 'l' }, color: 'auto', gauge: '6' }])
    expect(validate(nodes, bad).issues.some((i) => i.rule === 'DOM-001')).toBe(true)
  })
})

describe('simulation', () => {
  it('follows P_PV = P_STC × G/1000 × f × temperature × orientation at solar noon', () => {
    const { nodes, wires } = sampleProject()
    const v = validate(nodes, wires)
    const m = compute({ ...freshSim(), t: 12 * 60 }, v, 100)
    expect(m.G).toBeCloseTo(1000)
    // Ambient 30.9 °C at noon; NOCT 45 → cell 30.9 + 25/800 × 1000 = 62.2 °C; −0.35 %/°C.
    const tcell = ambientTemp(12) + ((45 - 20) / 800) * 1000
    expect(m.tcell).toBeCloseTo(tcell)
    const temp = 1 - 0.0035 * (tcell - 25)
    const orient = orientationFactor(nodes.find((n) => n.id === 'pv1')!)
    expect(m.ppv).toBeCloseTo(800 * 1 * PERFORMANCE_FACTOR * temp * orient)
  })

  it('produces nothing at night', () => {
    const { nodes, wires } = sampleProject()
    expect(compute({ ...freshSim(), t: 22 * 60 }, validate(nodes, wires), 100).ppv).toBe(0)
  })

  it('is deterministic', () => {
    const { nodes, wires } = sampleProject()
    expect(simulateDays(nodes, wires, 1)).toEqual(simulateDays(nodes, wires, 1))
  })
})

import { makeNode } from './catalog'
import { RULES } from './rules'
import type { LabNode } from './types'

const wire = (id: string, an: string, at: string, bn: string, bt: string, gauge = 16, length?: number): Wire => ({ id, a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: String(gauge), ...(length ? { length } : {}) })
const bat = (id: string, specs: Partial<Record<string, number>> = {}): LabNode => {
  const n = makeNode('bat', 0, 0, id)
  return { ...n, specs: { ...n.specs, ...specs } as Record<string, number> }
}
const rules = (nodes: LabNode[], wires: Wire[]) => validate(nodes, wires).issues.map((i) => i.rule)

describe('battery banks', () => {
  const cc = makeNode('mppt', 0, 0, 'cc1')

  it('two 12.8 V batteries in series form a 25.6 V bank without a polarity fault', () => {
    const nodes = [cc, bat('b1', { nomV: 12.8 }), bat('b2', { nomV: 12.8 })]
    const wires = [wire('1', 'cc1', 'bp', 'b1', 'p'), wire('2', 'b1', 'n', 'b2', 'p'), wire('3', 'b2', 'n', 'cc1', 'bn')]
    const v = validate(nodes, wires)
    expect(v.sys.bank).toMatchObject({ nomV: 25.6, ah: 200, strings: [[{ id: 'b1' }, { id: 'b2' }]] })
    expect(v.issues.map((i) => i.rule)).not.toContain('POL-001')
  })

  it('parallel strings add capacity and current limits', () => {
    const nodes = [cc, bat('b1'), bat('b2')]
    const wires = [wire('1', 'cc1', 'bp', 'b1', 'p'), wire('2', 'cc1', 'bp', 'b2', 'p'), wire('3', 'b1', 'n', 'cc1', 'bn'), wire('4', 'b2', 'n', 'cc1', 'bn')]
    expect(validate(nodes, wires).sys.bank).toMatchObject({ nomV: 25.6, ah: 400, maxC: 200, maxD: 300, kwh: 10.24 })
  })

  it('flags parallel strings at different voltages (BAT-001) and mixed batteries (BAT-002)', () => {
    const nodes = [cc, bat('b1'), bat('b2', { nomV: 12.8 }), bat('b3', { nomV: 12.8 }), bat('b4', { nomV: 12.8 })]
    // String A: b1 (25.6 V). String B: b2+b3+b4 (38.4 V).
    const wires = [
      wire('1', 'cc1', 'bp', 'b1', 'p'),
      wire('2', 'b1', 'n', 'cc1', 'bn'),
      wire('3', 'cc1', 'bp', 'b2', 'p'),
      wire('4', 'b2', 'n', 'b3', 'p'),
      wire('5', 'b3', 'n', 'b4', 'p'),
      wire('6', 'b4', 'n', 'cc1', 'bn'),
    ]
    expect(rules(nodes, wires)).toEqual(expect.arrayContaining(['BAT-001', 'BAT-002']))
  })

  it('reports an open battery string (TOP-005)', () => {
    const nodes = [cc, bat('b1', { nomV: 12.8 }), bat('b2', { nomV: 12.8 })]
    const wires = [wire('1', 'cc1', 'bp', 'b1', 'p'), wire('2', 'b1', 'n', 'b2', 'p')]
    expect(rules(nodes, wires)).toEqual(expect.arrayContaining(['TOP-005', 'TOP-002']))
  })

  it('warns when the controller can over-charge the bank (RAT-006)', () => {
    const nodes = [cc, bat('b1', { maxC: 40 })]
    const wires = [wire('1', 'cc1', 'bp', 'b1', 'p'), wire('2', 'b1', 'n', 'cc1', 'bn')]
    expect(rules(nodes, wires)).toContain('RAT-006')
  })

  it('simulates SOC against the whole bank', () => {
    const { nodes, wires } = sampleProject()
    const one = simulateDays(nodes, wires, 1)
    const bigger = sampleProject()
    const nodes2 = bigger.nodes.map((n) => (n.id === 'bat1' ? { ...n, specs: { ...n.specs, ah: 400 } } : n))
    const two = simulateDays(nodes2, bigger.wires, 1)
    // Same energy flows, twice the capacity: half the SOC swing.
    expect(Math.abs(two.endSoc - 62)).toBeCloseTo(Math.abs(one.endSoc - 62) / 2, 0)
  })
})

describe('cable sizing and voltage drop', () => {
  it('computes round-trip drop and flags RAT-007 above 3%', () => {
    const { nodes, wires } = sampleProject()
    const v = validate(nodes, wires)
    const pv = v.wres['w1'].drop!
    expect(pv.length).toBe(3)
    expect(pv.volts).toBeCloseTo((2 * 3 * 10.4 * 0.0175) / 6)
    expect(v.issues.map((i) => i.rule)).not.toContain('RAT-007')

    const long = wires.map((w) => (w.id === 'w4' ? { ...w, length: 15 } : w))
    const v2 = validate(nodes, long)
    expect(v2.wres['w4'].fail?.rule).toBe('RAT-007')
    expect(v2.wres['w4'].fail?.fix).toMatch(/at least \d+ mm²/)
  })
})

describe('rule registry', () => {
  it('every rule the engine can emit has PRD §7.3 metadata', () => {
    for (const r of Object.values(RULES)) {
      expect(r.id && r.title && r.severity && r.appliesTo && r.detection && r.explanation && r.reference && r.version).toBeTruthy()
    }
  })

  it('every rule id used in validation.ts is registered', async () => {
    const src = await import('./validation.ts?raw').then((m) => m.default as string)
    const used = new Set(src.match(/'(TRM|DOM|POL|RAT|BAT|TOP|PRT|GND|INF|AC|NM)-\d{3}'/g)!.map((s) => s.slice(1, -1)))
    expect([...used].filter((id) => !RULES[id])).toEqual([])
  })
})
