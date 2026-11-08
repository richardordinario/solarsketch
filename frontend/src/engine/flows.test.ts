import { describe, expect, it } from 'vitest'

import type { Fault } from './faults'
import { wireFlows } from './flows'
import { gridTiedProject, sampleProject } from './sample-project'
import { compute, freshSim, type SimState } from './simulation'
import type { Wire } from './types'
import { validate } from './validation'

const at = (h: number, extra: Partial<SimState> = {}): SimState => ({ ...freshSim(), t: h * 60, started: true, ...extra })
const wireId = (wires: Wire[], an: string, at_: string, bn: string, bt: string) => wires.find((w) => w.a.n === an && w.a.t === at_ && w.b.n === bn && w.b.t === bt)!.id

describe('wire flows', () => {
  const { nodes, wires } = sampleProject()
  const v = validate(nodes, wires)
  const flowsAt = (h: number, faults: Fault[] = []) => {
    const sim = at(h)
    return wireFlows(nodes, wires, v, compute(sim, v, 85, faults), sim.t, faults)
  }

  it('noon: PV pushes current through the string into the controller and on into the battery', () => {
    const f = flowsAt(12)
    const pvIn = f[wireId(wires, 'pv1', 'p', 'cc1', 'pvp')]
    const ret = f[wireId(wires, 'pv2', 'n', 'cc1', 'pvn')]
    const mid = f[wireId(wires, 'pv1', 'n', 'pv2', 'p')]
    expect(pvIn).toMatchObject({ dir: 1 })
    expect(ret).toMatchObject({ dir: -1 })
    expect(mid.amps).toBeCloseTo(pvIn.amps)
    expect(ret.amps).toBeCloseTo(pvIn.amps)
    expect(f[wireId(wires, 'cc1', 'bp', 'bat1', 'p')]).toMatchObject({ dir: 1 })
  })

  it('night: the battery feeds the inverter through the breaker, and the board feeds the LED', () => {
    const f = flowsAt(20)
    expect(f[wireId(wires, 'pv1', 'p', 'cc1', 'pvp')]).toBeUndefined()
    const toBreaker = f[wireId(wires, 'bat1', 'p', 'dcb1', 'i')]
    const toInv = f[wireId(wires, 'dcb1', 'o', 'inv1', 'dp')]
    expect(toBreaker).toMatchObject({ dir: 1 })
    expect(toInv.amps).toBeCloseTo(toBreaker.amps)
    expect(f[wireId(wires, 'inv1', 'l', 'db1', 'l')]).toMatchObject({ dir: 1 })
    const led = f[wireId(wires, 'db1', 'l1', 'ld1', 'l')]
    expect(led.dir).toBe(1)
    expect(led.amps).toBeCloseTo(60 / 230)
    expect(f[wireId(wires, 'db1', 'n1', 'ld1', 'n')]).toMatchObject({ dir: -1 })
    // The earth conductor never carries load current.
    expect(f[wireId(wires, 'db1', 'pe', 'g1', 'pe')]).toBeUndefined()
  })

  it('a tripped breaker stops the flow to the inverter', () => {
    const f = flowsAt(20, [{ id: 'b', kind: 'breaker-trip', target: 'dcb1' }])
    expect(f[wireId(wires, 'dcb1', 'o', 'inv1', 'dp')]).toBeUndefined()
  })

  it('grid-tied: export at noon flows out towards the grid, import at night flows in', () => {
    const g = gridTiedProject()
    const gv = validate(g.nodes, g.wires)
    const gridWire = g.wires.find((w) => [w.a.n, w.b.n].includes('grid1') && [w.a.t, w.b.t].includes('l'))!
    const towardGrid = (h: number) => {
      const sim = at(h)
      const f = wireFlows(g.nodes, g.wires, gv, compute(sim, gv, 85), sim.t)[gridWire.id]
      return f && (gridWire.b.n === 'grid1' ? f.dir === 1 : f.dir === -1)
    }
    expect(towardGrid(12)).toBe(true)
    expect(towardGrid(21)).toBe(false)
  })
})
