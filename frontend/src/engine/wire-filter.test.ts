import { describe, expect, it } from 'vitest'

import { sampleProject } from './sample-project'
import { nodeMap, validate } from './validation'
import { DEFAULT_WIRE_FILTER, wireDomain, wireVisibility, type WireFilter } from './wire-filter'

describe('wire filter', () => {
  const { nodes, wires } = sampleProject()
  const nm = nodeMap(nodes)
  const v = validate(nodes, wires)
  const none = { nodes: [], wire: null }
  const f = (p: Partial<WireFilter>): WireFilter => ({ ...DEFAULT_WIRE_FILTER, ...p })
  const vis = (filter: WireFilter, sel: { nodes: string[]; wire: string | null } = none) => wireVisibility(wires, nm, v, filter, sel)

  it('shows every wire by default', () => {
    expect(Object.values(vis(DEFAULT_WIRE_FILTER)).every((x) => x === 'show')).toBe(true)
  })

  it('classifies the sample wires into DC, AC and PE', () => {
    const domains = new Set(wires.map((w) => wireDomain(w, nm)))
    expect(domains).toEqual(new Set(['dc', 'ac', 'pe']))
  })

  it('hides a domain that is switched off', () => {
    const r = vis(f({ domains: { dc: false, ac: true, pe: true } }))
    for (const w of wires) expect(r[w.id]).toBe(wireDomain(w, nm) === 'dc' ? 'hide' : 'show')
  })

  it('hides everything except the selected wire', () => {
    const r = vis(f({ mode: 'hidden' }), { nodes: [], wire: wires[0].id })
    expect(r[wires[0].id]).toBe('show')
    expect(wires.slice(1).every((w) => r[w.id] === 'hide')).toBe(true)
  })

  it('focus fades wires not attached to the selection', () => {
    const id = wires[0].a.n
    const r = vis(f({ mode: 'focus' }), { nodes: [id], wire: null })
    for (const w of wires) expect(r[w.id]).toBe(w.a.n === id || w.b.n === id ? 'show' : 'dim')
    // With nothing selected, focus shows everything.
    expect(Object.values(vis(f({ mode: 'focus' }))).every((x) => x === 'show')).toBe(true)
  })

  it('problems only keeps failing wires', () => {
    const r = vis(f({ problemsOnly: true }))
    for (const w of wires) expect(r[w.id]).toBe(v.wres[w.id]?.fail ? 'show' : 'hide')
  })
})
