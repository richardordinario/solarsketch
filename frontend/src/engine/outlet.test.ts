import { describe, expect, it } from 'vitest'

import { makeNode } from './catalog'
import type { Fault } from './faults'
import { measureNode } from './measure'
import { sampleProject } from './sample-project'
import { compute, freshSim, step, type SimState } from './simulation'
import type { LabNode, Wire } from './types'
import { validate } from './validation'

const at = (h: number, extra: Partial<SimState> = {}): SimState => ({ ...freshSim(), t: h * 60, started: true, ...extra })
const rules = (v: ReturnType<typeof validate>, node?: string) => v.issues.filter((i) => !node || i.target.node === node).map((i) => i.rule)

type Link = [string, string, string, string]
const wire = ([an, at, bn, bt]: Link, i: number): Wire => ({ id: 'x' + i, a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: '2.5' })

/** The sample house with a duplex outlet on board circuit 2, feeding a fan and a TV instead of the fridge. */
function withOutlet(opts: { earthed?: boolean; feed?: 'board' | 'inverter'; tvWatts?: number } = {}) {
  const { earthed = true, feed = 'board', tvWatts } = opts
  const base = sampleProject()
  const nodes: LabNode[] = base.nodes.filter((n) => n.id !== 'ld2')
  const out = makeNode('outlet', 1360, 250, 'o1')
  const fan = makeNode('fan', 1620, 200, 'fan1')
  const tv = makeNode('tv', 1620, 320, 'tv1')
  nodes.push(out, fan, tvWatts ? { ...tv, specs: { ...tv.specs, p: tvWatts } } : tv)
  const wires = base.wires.filter((w) => w.a.n !== 'ld2' && w.b.n !== 'ld2')
  const links: Link[] = [
    feed === 'board' ? ['db1', 'l2', 'o1', 'l'] : ['inv1', 'l', 'o1', 'l'],
    feed === 'board' ? ['db1', 'n2', 'o1', 'n'] : ['inv1', 'n', 'o1', 'n'],
    ['o1', 'l1', 'fan1', 'l'],
    ['o1', 'n1', 'fan1', 'n'],
    ['o1', 'l2', 'tv1', 'l'],
    ['o1', 'n2', 'tv1', 'n'],
  ]
  if (earthed) links.push(['g1', 'pe', 'o1', 'pe'])
  return { nodes, wires: wires.concat(links.map(wire)) }
}

describe('convenience outlet', () => {
  it('passes the board circuit through to loads plugged into its sockets', () => {
    const { nodes, wires } = withOutlet()
    const v = validate(nodes, wires)
    for (const id of ['o1', 'fan1', 'tv1']) expect(v.issues.filter((i) => i.target.node === id && i.sev !== 'info'), id).toEqual([])
    expect(v.sys.acSupplied.map((l) => l.id).sort()).toEqual(['fan1', 'ld1', 'tv1'])
    expect(v.sys.boardOf).toMatchObject({ fan1: 'db1', tv1: 'db1', ld1: 'db1' })
    expect(v.sys.outletsOf).toEqual({ fan1: ['o1'], tv1: ['o1'] })
    expect(v.sys.outletBoard.o1).toBe('db1')

    // 20:00: fan (10–18 h) is off, TV (19–22 h) is on.
    const m = compute(at(20), v, 85)
    expect(m.onLoads.map((l) => l.id)).toContain('tv1')
    expect(m.ac.outletsLive).toEqual(['o1'])
    const r = measureNode(nodes.find((n) => n.id === 'o1')!, at(20), m, v, [])
    expect(r.find((x) => x.label === 'Load current')?.value).toBe(`${(90 / 230).toFixed(2)} A`)
    expect(r.every((x) => !x.abnormal)).toBe(true)
  })

  it('warns when the plugged-in loads exceed the outlet rating', () => {
    const v = validate(...Object.values(withOutlet({ tvWatts: 3500 })) as [LabNode[], Wire[]])
    expect(rules(v, 'o1')).toContain('RAT-011')
  })

  it('warns when the outlet earth is not connected', () => {
    const v = validate(...Object.values(withOutlet({ earthed: false })) as [LabNode[], Wire[]])
    expect(rules(v, 'o1')).toContain('GND-003')
  })

  it('warns when the outlet bypasses the distribution board', () => {
    const v = validate(...Object.values(withOutlet({ feed: 'inverter' })) as [LabNode[], Wire[]])
    expect(rules(v, 'o1')).toContain('PRT-004')
    expect(v.sys.boardOf.tv1).toBeUndefined()
  })

  it('an earth leak behind the outlet trips the board RCD and kills the socket', () => {
    const { nodes, wires } = withOutlet()
    const v = validate(nodes, wires)
    const leak: Fault = { id: 'f', kind: 'ground-fault', target: 'tv1' }
    let sim = at(19.5)
    for (let i = 0; i < 3; i++) sim = step(sim, v, 85, 0, nodes, [leak]).sim
    expect(sim.rcdTripped).toContain('db1')
    const m = compute(sim, v, 85, [leak])
    expect(m.ac.outletsLive).toEqual([])
    expect(m.rcdOff.map((l) => l.id)).toContain('tv1')
  })
})
