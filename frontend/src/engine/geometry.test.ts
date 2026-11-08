import { describe, expect, it } from 'vitest'

import { makeNode } from './catalog'
import { WIRE_LANE, keepCentre, nextRotation, nodeSize, terminal, terminalPos, wireMidpoint, wirePath, wireRoutes } from './geometry'
import type { LabNode, Rotation } from './types'

const inv = (rot?: Rotation): LabNode => ({ ...makeNode('inv', 100, 200, 'inv1'), ...(rot ? { rot } : {}) })

describe('rotation', () => {
  it('cycles 0 → 90 → 180 → 270 → 0', () => {
    expect([undefined, 90, 180, 270].map((r) => nextRotation(r as Rotation | undefined))).toEqual([90, 180, 270, 0])
  })

  it('moves the left (DC) and right (AC) terminals clockwise', () => {
    const sides = ([0, 90, 180, 270] as Rotation[]).map((r) => [terminal(inv(r), 'dp')!.side, terminal(inv(r), 'l')!.side])
    expect(sides).toEqual([
      ['L', 'R'],
      ['T', 'B'],
      ['R', 'L'],
      ['B', 'T'],
    ])
  })

  it('puts every terminal on the card edge, pointing outwards', () => {
    for (const r of [0, 90, 180, 270] as Rotation[]) {
      const n = inv(r)
      const { w, h } = nodeSize(n)
      for (const tid of ['dp', 'dn', 'l', 'n', 'pe']) {
        const p = terminalPos(n, tid)
        const onEdge = (p.x === n.x && p.dx === -1) || (p.x === n.x + w && p.dx === 1) || (p.y === n.y && p.dy === -1) || (p.y === n.y + h && p.dy === 1)
        expect(onEdge, `${tid} at ${r}°`).toBe(true)
        expect(p.x).toBeGreaterThanOrEqual(n.x)
        expect(p.x).toBeLessThanOrEqual(n.x + w)
      }
    }
  })

  it('keeps terminals on one edge distinct', () => {
    const n = inv(90)
    const xs = ['l', 'n', 'pe'].map((tid) => terminalPos(n, tid).x)
    expect(new Set(xs).size).toBe(3)
  })

  it('keeps the card centre when the size changes', () => {
    const a = inv()
    const b = { ...a, rot: 90 as const }
    const c = keepCentre(a, b)
    const sa = nodeSize(a)
    const sb = nodeSize(b)
    expect(c.x + sb.w / 2).toBeCloseTo(a.x + sa.w / 2)
    expect(c.y + sb.h / 2).toBeCloseTo(a.y + sa.h / 2)
  })
})

describe('wire paths', () => {
  const h = { x: 0, y: 0, dx: 1, dy: 0 }
  const v = { x: 100, y: 100, dx: 0, dy: -1 }

  it('keeps the classic horizontal route unchanged', () => {
    expect(wirePath(h, { x: 200, y: 50, dx: -1, dy: 0 }, 'orthogonal')).toBe('M0,0 L20,0 L100,0 L100,50 L180,50 L200,50')
  })

  it('routes between horizontal and vertical terminals with right angles only', () => {
    for (const d of [wirePath(h, v, 'orthogonal'), wirePath(v, h, 'orthogonal'), wirePath(v, { x: 300, y: 0, dx: 0, dy: 1 }, 'orthogonal')]) {
      const pts = d
        .replace(/[ML]/g, '')
        .trim()
        .split(/\s+/)
        .map((p) => p.split(',').map(Number))
      for (let i = 1; i < pts.length; i++) expect(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1]).toBe(true)
    }
    expect(wireMidpoint(h, v, 'orthogonal')).toEqual({ x: 100, y: 0 })
    expect(wirePath(h, v, 'curved')).toMatch(/^M0,0 C/)
  })
})

describe('wire routes', () => {
  // Two wires from the inverter's right side to a load's left side share one middle column by default.
  const nodes = [makeNode('inv', 0, 0, 'i'), makeNode('led', 400, 240, 'l')]
  const nm = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const wire = (id: string, t: string, bend?: number) => ({ id, a: { n: 'i', t }, b: { n: 'l', t }, ...(bend !== undefined ? { bend } : {}) })
  const midX = (d: string) => Number(d.split(' ')[2].slice(1).split(',')[0])

  it('separates parallel wires that would lie on top of each other', () => {
    const r = wireRoutes([wire('w1', 'l'), wire('w2', 'n')], nm, 'orthogonal')
    expect(r.w1.bend).toBe(0)
    expect(Math.abs(r.w2.bend)).toBe(WIRE_LANE)
    expect(Math.abs(midX(r.w1.d) - midX(r.w2.d))).toBe(WIRE_LANE)
    expect(r.w1.axis).toBe('x')
  })

  it('keeps a manual bend and routes the others around it', () => {
    const r = wireRoutes([wire('w1', 'l', 40), wire('w2', 'n')], nm, 'orthogonal')
    expect(r.w1.bend).toBe(40)
    expect(r.w2.bend).toBe(0)
    expect(midX(r.w1.d) - midX(r.w2.d)).toBe(40)
  })

  it('a zero bend gives the default path, and the handle sits on the moved segment', () => {
    const a = terminalPos(nodes[0], 'l')
    const b = terminalPos(nodes[1], 'l')
    expect(wirePath(a, b, 'orthogonal', 0)).toBe(wirePath(a, b, 'orthogonal'))
    const r = wireRoutes([wire('w1', 'l', 30)], nm, 'orthogonal')
    expect(r.w1.handle.x).toBe(midX(r.w1.d))
  })

  it('bends right-angle routes between horizontal and vertical terminals without diagonals', () => {
    const h = { x: 0, y: 0, dx: 1, dy: 0 }
    const v = { x: 100, y: 100, dx: 0, dy: -1 }
    for (const d of [wirePath(h, v, 'orthogonal', 30), wirePath(v, h, 'orthogonal', -30)]) {
      const pts = d.replace(/[ML]/g, '').trim().split(/\s+/).map((p) => p.split(',').map(Number))
      for (let i = 1; i < pts.length; i++) expect(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1]).toBe(true)
    }
  })
})
