import { describe, expect, it } from 'vitest'

import { makeNode } from '@/engine/catalog'
import type { Fault } from '@/engine/faults'
import type { ComponentType, LabNode, Wire } from '@/engine/types'

import { LESSONS, lessonById } from './lessons'
import { CHALLENGES, TASKS, evaluate, score, taskById } from './tasks'

const w = (id: string, an: string, at: string, bn: string, bt: string, gauge = 6): Wire => ({ id, a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: String(gauge) })
const n = (id: string, type: ComponentType, x = 0, y = 0) => makeNode(type, x, y, id)

interface Project {
  nodes: LabNode[]
  wires: Wire[]
}
type Solution = (p: Project) => Project

/** Rewire only. */
const rewire =
  (drop: string[], add: Wire[]): Solution =>
  ({ nodes, wires }) => ({ nodes, wires: wires.filter((x) => !drop.includes(x.id)).concat(add) })
const editSpecs = (nodes: LabNode[], edits: Record<string, Record<string, number>>) => nodes.map((x) => (edits[x.id] ? { ...x, specs: { ...x.specs, ...edits[x.id] } } : x))

/** The clean off-grid DC/AC wiring for nodes pv1, pv2, cc1, bat1, dcb1, inv1, db1, g1, ld1, ld2. */
const offGridWires = () => [
  w('s1', 'pv1', 'p', 'cc1', 'pvp'),
  w('s2', 'pv1', 'n', 'pv2', 'p'),
  w('s4', 'cc1', 'bp', 'bat1', 'p', 16),
  w('s5', 'cc1', 'bn', 'bat1', 'n', 16),
  w('s6', 'bat1', 'p', 'dcb1', 'i', 25),
  w('s7', 'dcb1', 'o', 'inv1', 'dp', 25),
  w('s8', 'bat1', 'n', 'inv1', 'dn', 50),
  w('s9', 'inv1', 'l', 'db1', 'l', 4),
  w('s10', 'inv1', 'n', 'db1', 'n', 4),
  w('s11', 'db1', 'pe', 'g1', 'pe'),
  w('s12', 'db1', 'l1', 'ld1', 'l', 2.5),
  w('s13', 'db1', 'n1', 'ld1', 'n', 2.5),
  w('s14', 'db1', 'l2', 'ld2', 'l', 2.5),
  w('s15', 'db1', 'n2', 'ld2', 'n', 2.5),
  w('s16', 'inv1', 'pe', 'g1', 'pe'),
]

/** Equipment bonding (BND-001): PE of PV frames, controllers and battery enclosures to the grounding rod g1. */
const bond = (ids: string[]) => ids.map((id) => w(`bond-${id}`, id, 'pe', 'g1', 'pe'))

/** Reference solutions: each takes the starter project and returns a correct one. */
const solutions: Record<string, Solution> = {
  'practice-pv-terminals': rewire([], [w('s1', 'pv1', 'p', 'cc1', 'pvp'), w('s2', 'pv1', 'n', 'cc1', 'pvn')]),
  'practice-polarity': rewire(['w1', 'w2'], [w('s1', 'pv1', 'p', 'cc1', 'pvp'), w('s2', 'pv1', 'n', 'cc1', 'pvn')]),
  'practice-series': rewire([], [w('s1', 'pv1', 'p', 'cc1', 'pvp'), w('s2', 'pv1', 'n', 'pv2', 'p'), w('s3', 'pv2', 'n', 'cc1', 'pvn')]),
  'practice-parallel': rewire([], [w('s1', 'pv1', 'p', 'cc1', 'pvp'), w('s2', 'pv2', 'p', 'cc1', 'pvp'), w('s3', 'pv1', 'n', 'cc1', 'pvn'), w('s4', 'pv2', 'n', 'cc1', 'pvn')]),
  'practice-battery': rewire([], [w('s1', 'cc1', 'bp', 'bat1', 'p', 16), w('s2', 'cc1', 'bn', 'bat1', 'n', 16)]),
  'practice-battery-bank': rewire(
    [],
    [
      w('s1', 'bat1', 'n', 'bat2', 'p', 16),
      w('s2', 'bat3', 'n', 'bat4', 'p', 16),
      w('s3', 'cc1', 'bp', 'bat1', 'p', 16),
      w('s4', 'cc1', 'bp', 'bat3', 'p', 16),
      w('s5', 'cc1', 'bn', 'bat2', 'n', 16),
      w('s6', 'cc1', 'bn', 'bat4', 'n', 16),
    ],
  ),
  'practice-inverter': rewire(
    ['w19', 'w20'],
    [w('s1', 'dcb1', 'o', 'inv1', 'dp', 25), w('s2', 'bat1', 'n', 'inv1', 'dn', 50), w('s3', 'inv1', 'l', 'db1', 'l', 4), w('s4', 'inv1', 'n', 'db1', 'n', 4), w('s5', 'inv1', 'pe', 'g1', 'pe')],
  ),
  'practice-protection': rewire(['w6'], [w('s1', 'bat1', 'p', 'dcb1', 'i', 25), w('s2', 'dcb1', 'o', 'inv1', 'dp', 25), w('s3', 'inv1', 'pe', 'g1', 'pe', 6)]),
  'practice-ac-protection': ({ nodes, wires }) => ({
    nodes: editSpecs(nodes, { db1: { rcd: 30 } }),
    wires: wires.filter((x) => x.id !== 'w17' && x.id !== 'w18').concat([w('s1', 'db1', 'l1', 'out1', 'l', 2.5), w('s2', 'db1', 'n1', 'out1', 'n', 2.5), w('s3', 'out1', 'pe', 'g1', 'pe', 2.5)]),
  }),
  'practice-grounding': rewire(['w16'], [w('s1', 'inv1', 'pe', 'g1', 'pe'), w('s2', 'db1', 'pe', 'g1', 'pe'), ...bond(['pv1', 'pv2', 'cc1', 'bat1'])]),
  'practice-analyze-system': ({ nodes, wires }) => ({ nodes: editSpecs(nodes, { cc1: { maxI: 50 }, dcb1: { maxV: 250 } }), wires: wires.concat([w('s1', 'db1', 'pe', 'g1', 'pe'), ...bond(['pv1', 'pv2', 'cc1', 'bat1'])]) }),
  'practice-grid-tied': rewire([], [w('s1', 'grid1', 'l', 'nm1', 'gl', 16), w('s2', 'grid1', 'n', 'nm1', 'gn', 16), w('s3', 'nm1', 'l', 'db1', 'l'), w('s4', 'nm1', 'n', 'db1', 'n')]),
  'practice-cable-sizing': ({ nodes, wires }) => ({ nodes, wires: wires.map((x) => (x.id === 'w1' ? { ...x, gauge: '6' } : x.id === 'w8' ? { ...x, gauge: '50' } : x)) }),
  'practice-two-mppt': rewire(
    [],
    [w('s1', 'pv3', 'p', 'cc2', 'pvp'), w('s2', 'pv3', 'n', 'pv4', 'p'), w('s3', 'pv4', 'n', 'cc2', 'pvn'), w('s4', 'cc2', 'bp', 'bat1', 'p', 16), w('s5', 'cc2', 'bn', 'bat1', 'n', 16)],
  ),
  'build-basic-system': ({ nodes }) => ({
    // 2S2P: three modules in series would exceed the 150 V input on a cold morning (RAT-012).
    nodes: nodes.concat([n('pv1', 'pv'), n('pv2', 'pv'), n('pv3', 'pv'), n('pv4', 'pv'), n('cc1', 'mppt'), n('bat1', 'bat'), n('dcb1', 'dcb'), n('inv1', 'inv'), n('db1', 'acdb'), n('g1', 'gnd')]),
    wires: offGridWires().concat([w('s3', 'pv2', 'n', 'cc1', 'pvn'), w('s3a', 'pv3', 'p', 'cc1', 'pvp'), w('s3b', 'pv3', 'n', 'pv4', 'p'), w('s3c', 'pv4', 'n', 'cc1', 'pvn'), ...bond(['pv1', 'pv2', 'pv3', 'pv4', 'cc1', 'bat1'])]),
  }),
  'fix-connections': rewire(['w7', 'w8', 'w12', 'w13'], [w('s1', 'dcb1', 'o', 'inv1', 'dp', 25), w('s2', 'bat1', 'n', 'inv1', 'dn', 50), w('s3', 'db1', 'l1', 'ld1', 'l', 2.5), w('s4', 'db1', 'n1', 'ld1', 'n', 2.5)]),
  'configure-battery-bank': rewire(
    [],
    [
      w('s1', 'bat1', 'n', 'bat2', 'p', 16),
      w('s2', 'bat3', 'n', 'bat4', 'p', 16),
      w('s3', 'bat5', 'n', 'bat6', 'p', 16),
      ...['bat1', 'bat3', 'bat5'].map((b, i) => w(`s4${i}`, 'cc1', 'bp', b, 'p', 16)),
      ...['bat2', 'bat4', 'bat6'].map((b, i) => w(`s5${i}`, 'cc1', 'bn', b, 'n', 16)),
      w('s6', 'bat1', 'p', 'dcb1', 'i', 25),
      w('s7', 'dcb1', 'o', 'inv1', 'dp', 25),
      w('s8', 'bat2', 'n', 'inv1', 'dn', 50),
    ],
  ),
  'battery-not-charging': rewire([], [w('s1', 'pv2', 'n', 'cc1', 'pvn')]),
  'controller-overvoltage': rewire(['w3'], [w('s1', 'pv2', 'n', 'cc1', 'pvn'), w('s2', 'pv3', 'p', 'cc1', 'pvp')]),
  'support-loads': ({ nodes, wires }) => ({
    nodes: nodes.concat([{ ...nodes.find((x) => x.id === 'pv1')!, id: 'pv3', y: 360 }]),
    wires: wires.filter((x) => x.id !== 'w3').concat([w('s1', 'pv2', 'n', 'pv3', 'p'), w('s2', 'pv3', 'n', 'cc1', 'pvn')]),
  }),
  'failed-module': (p) => p,
  'rcd-trips': (p) => p,
}

/** Reference repairs for fault challenges: the faults that remain after a correct fix. */
const faultSolutions: Record<string, (fs: Fault[]) => Fault[]> = {
  'failed-module': (fs) => fs.filter((f) => f.kind !== 'module-open'),
  'rcd-trips': (fs) => fs.filter((f) => f.kind !== 'ground-fault'),
}

describe('tasks', () => {
  it('every task has a reference solution', () => {
    expect(Object.keys(solutions).sort()).toEqual(TASKS.map((t) => t.id).sort())
  })

  it('task ids are unique', () => expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length))

  for (const task of TASKS) {
    it(`${task.id}: starter fails and the reference solution passes`, () => {
      const start = task.starter()
      expect(evaluate(task, start.nodes, start.wires, { full: true, faults: start.faults }).passed).toBe(false)

      const solved = solutions[task.id]({ nodes: start.nodes, wires: start.wires })
      const faults = (faultSolutions[task.id] ?? ((f) => f))(start.faults ?? [])
      const ev = evaluate(task, solved.nodes, solved.wires, { full: true, faults })
      expect(ev.results.filter((r) => !r.met).map((r) => r.label)).toEqual([])
    })
  }

  it('every challenge lists allowed components and an expected outcome', () => {
    for (const c of CHALLENGES) {
      expect(c.allowed?.length, c.id).toBeGreaterThan(0)
      expect(c.expectedOutcome, c.id).toBeTruthy()
      // The starting system only uses allowed components.
      expect(c.starter().nodes.filter((x) => !c.allowed!.includes(x.type)).map((x) => x.type), c.id).toEqual([])
    }
  })

  it('prerequisites, lesson links and practice lists are consistent', () => {
    for (const t of TASKS) {
      for (const id of t.prerequisites) expect(lessonById(id), `${t.id} prerequisite ${id}`).toBeTruthy()
      if (t.kind === 'practice') {
        expect(t.lessonId && lessonById(t.lessonId)?.practice, t.id).toContain(t.id)
        // A practice task never requires its own lesson or a later one.
        const own = LESSONS.findIndex((l) => l.id === t.lessonId)
        for (const id of t.prerequisites) expect(LESSONS.findIndex((l) => l.id === id), `${t.id} prerequisite ${id}`).toBeLessThan(own)
      }
    }
    for (const l of LESSONS) for (const id of l.practice) expect(taskById(id)?.lessonId, `${l.id} practice ${id}`).toBe(l.id)
  })

  it('the load challenge fails if a load schedule is shortened', () => {
    const task = taskById('support-loads')!
    const { nodes, wires } = task.starter()
    const edited = nodes.map((x) => (x.id === 'ld2' ? { ...x, specs: { ...x.specs, off: 12 } } : x))
    const ev = evaluate(task, edited, wires, { full: true })
    expect(ev.results.find((r) => r.id === 'loads-unchanged')?.met).toBe(false)
  })

  it('the battery-bank challenge rejects an oversized bank and edited batteries', () => {
    const task = taskById('configure-battery-bank')!
    const start = task.starter()
    const solved = solutions[task.id](start)
    const oversized = solved.wires.concat([w('x1', 'bat7', 'n', 'bat8', 'p', 16), w('x2', 'cc1', 'bp', 'bat7', 'p', 16), w('x3', 'cc1', 'bn', 'bat8', 'n', 16)])
    expect(evaluate(task, solved.nodes, oversized, { full: true }).results.find((r) => r.id === 'no-excess')?.met).toBe(false)
    const edited = editSpecs(solved.nodes, { bat1: { ah: 200 } })
    expect(evaluate(task, edited, solved.wires, { full: true }).results.find((r) => r.id === 'specs-kept')?.met).toBe(false)
  })
})

describe('lessons', () => {
  it('cover Levels 1–5 with unique ids and valid knowledge checks', () => {
    expect(new Set(LESSONS.map((l) => l.level))).toEqual(new Set([1, 2, 3, 4, 5]))
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length)
    for (const l of LESSONS) {
      expect(l.check.length, l.id).toBeGreaterThanOrEqual(3)
      for (const q of l.check) expect(q.answer, `${l.id}: ${q.question}`).toBeLessThan(q.options.length)
    }
  })

  it('keep lessons in level order', () => {
    const levels = LESSONS.map((l) => l.level)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })
})

describe('score', () => {
  const passed = { results: [], met: 4, total: 4, passed: true }
  const failed = { results: [], met: 2, total: 4, passed: false }
  it('awards full marks for a first-time pass with a correct diagnosis', () => expect(score(passed, true, 0)).toBe(100))
  it('deducts understanding and completion', () => expect(score(passed, false, 2)).toBe(70))
  it('counts understanding even when the check fails', () => expect(score(failed, true, 0)).toBe(50))
  it('gives only correctness credit for a failed check with a wrong or missing diagnosis', () => {
    expect(score(failed, false, 0)).toBe(30)
    expect(score(failed, null, 0)).toBe(30)
  })
  it('gives understanding on a pass when the task has no diagnosis question', () => expect(score(passed, null, 1)).toBe(95))
  it('is deterministic', () => expect(score(failed, true, 3)).toBe(score(failed, true, 3)))
})
