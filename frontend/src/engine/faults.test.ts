import { describe, expect, it } from 'vitest'

import type { Fault } from './faults'
import { measureNode } from './measure'
import { sampleProject } from './sample-project'
import { simulateDays } from './scenario'
import { compute, freshSim, step } from './simulation'
import { validate } from './validation'

const noon = { ...freshSim(), t: 12 * 60, started: true }
const setup = () => {
  const { nodes, wires } = sampleProject()
  return { nodes, wires, v: validate(nodes, wires) }
}
const f = (kind: Fault['kind'], target: string, extra: Partial<Fault> = {}): Fault => ({ id: `${kind}-${target}`, kind, target, ...extra })

describe('fault effects', () => {
  it('shading removes the shaded share of a module and a failed module kills its string', () => {
    const { v } = setup()
    const healthy = compute(noon, v, 100).ppv
    expect(compute(noon, v, 100, [f('shading', 'pv1', { shade: 0.5 })]).ppv).toBeCloseTo(healthy * 0.75)
    expect(compute(noon, v, 100, [f('module-open', 'pv2')]).ppv).toBe(0)
  })

  it('faults start at their scheduled time', () => {
    const { v } = setup()
    const later = [f('module-open', 'pv2', { startAt: 14 * 60 })]
    expect(compute(noon, v, 100, later).ppv).toBeGreaterThan(0)
    expect(compute({ ...noon, t: 15 * 60 }, v, 100, later).ppv).toBe(0)
  })

  it('a tripped DC breaker or BMS cut-off removes inverter output', () => {
    const { v } = setup()
    const evening = { ...noon, t: 20 * 60 }
    expect(compute(evening, v, 85).invOn).toBe(true)
    expect(compute(evening, v, 85, [f('breaker-trip', 'dcb1')]).invOn).toBe(false)
    const bms = compute(noon, v, 85, [f('bms-cutoff', 'bat1')])
    expect(bms.invOn).toBe(false)
    expect(bms.cc).toBe(0)
  })

  it('earth leakage trips the board RCD when the appliance switches on, and it stays off', () => {
    const { nodes, v } = setup()
    const faults = [f('ground-fault', 'ld1')] // LED lighting, on 18:00–23:00
    let sim = { ...freshSim(), t: 17 * 60 + 58 }
    sim = step(sim, v, 85, 0, nodes, faults).sim
    expect(sim.rcdTripped).toEqual([])
    sim = step(sim, v, 85, 0, nodes, faults).sim
    expect(sim.rcdTripped).toEqual(['db1'])
    const m = compute(sim, v, 85, faults)
    expect(m.onLoads).toEqual([])
    expect(m.rcdOff.map((l) => l.id).sort()).toEqual(['ld1', 'ld2'])
  })

  it('an over-temperature inverter derates to half its rating', () => {
    const { nodes, wires } = setup()
    const big = nodes.map((n) => (n.id === 'ld2' ? { ...n, specs: { ...n.specs, p: 1600 } } : n))
    const v = validate(big, wires)
    expect(compute(noon, v, 85).overload).toBe(false)
    expect(compute(noon, v, 85, [f('inverter-overtemp', 'inv1')]).overload).toBe(true)
  })

  it('counts RCD trips in the headless run', () => {
    const { nodes, wires } = setup()
    expect(simulateDays(nodes, wires, 1).rcdTrips).toBe(0)
    expect(simulateDays(nodes, wires, 1, 85, [f('ground-fault', 'ld1')]).rcdTrips).toBe(1)
  })
})

describe('measurements', () => {
  it('a failed module reads 0 V open-circuit in daylight and is flagged', () => {
    const { nodes, v } = setup()
    const faults = [f('module-open', 'pv2')]
    const m = compute(noon, v, 85, faults)
    const pv2 = measureNode(nodes.find((n) => n.id === 'pv2')!, noon, m, v, faults)
    const pv1 = measureNode(nodes.find((n) => n.id === 'pv1')!, noon, m, v, faults)
    expect(pv2[0]).toMatchObject({ value: '0.0 V', abnormal: true })
    expect(pv1[0].abnormal).toBe(false)
  })

  it('the insulation test fails only on the leaking appliance', () => {
    const { nodes, v } = setup()
    const faults = [f('ground-fault', 'ld2')]
    const m = compute(noon, v, 85, faults)
    const r = (id: string) => measureNode(nodes.find((n) => n.id === id)!, noon, m, v, faults)[1]
    expect(r('ld2').abnormal).toBe(true)
    expect(r('ld1').abnormal).toBe(false)
  })
})
