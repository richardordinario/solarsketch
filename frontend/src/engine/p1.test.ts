import { describe, expect, it } from 'vitest'

import { CATALOG, LOAD_TYPES, isPv } from './catalog'
import { COMPONENT_IMAGES } from './component-images'
import { DEVICE_IMAGES } from './device-images'
import { HOUSE_FRONT_Z, layout3d, sunDirection, terminalPos3d, type Placement } from './layout3d'
import { PROFILES, deviceProfiles, makeDeviceNode, matchesProfile, nodeTitle, profileById, profileSpecs } from './profiles'
import { hybridProject, sampleProject } from './sample-project'
import { compute, freshSim } from './simulation'
import type { Wire } from './types'
import { validate } from './validation'
import { makeNode } from './catalog'

describe('3D layout', () => {
  it.each(['lab', 'rooftop'] as const)('places every component and terminal at finite positions (%s)', (env) => {
    const { nodes } = sampleProject()
    const l = layout3d(nodes, env)
    for (const n of nodes) {
      const p = l.placements[n.id]
      expect(p.position.every(Number.isFinite)).toBe(true)
      for (const [tid] of CATALOG[n.type].L.concat(CATALOG[n.type].R)) expect(terminalPos3d(n, tid, p).every(Number.isFinite)).toBe(true)
    }
  })

  it('puts PV modules on the roof in the rooftop environment', () => {
    const { nodes } = sampleProject()
    const l = layout3d(nodes, 'rooftop')
    expect(l.placements['pv1'].position[1]).toBeGreaterThan(3)
    expect(l.placements['bat1'].position[1]).toBeLessThan(1)
  })

  it('sets every rooftop component out in front of the house, loads grouped to the right', () => {
    const { nodes } = sampleProject()
    const l = layout3d(nodes, 'rooftop')
    const ground = nodes.filter((n) => !isPv(n)).map((n) => ({ n, p: l.placements[n.id] }))
    // Nothing (apart from the array on the roof) is inside the house.
    for (const { p } of ground) expect(p.position[2] - p.size[2] / 2).toBeGreaterThanOrEqual(HOUSE_FRONT_Z)
    const isLoad = (t: string) => (LOAD_TYPES as readonly string[]).includes(t) || t === 'outlet'
    const loads = ground.filter(({ n }) => isLoad(n.type))
    const equipment = ground.filter(({ n }) => !isLoad(n.type))
    expect(loads.length).toBeGreaterThan(0)
    const right = (x: { p: Placement }) => x.p.position[0] + x.p.size[0] / 2
    const left = (x: { p: Placement }) => x.p.position[0] - x.p.size[0] / 2
    expect(Math.min(...loads.map(left))).toBeGreaterThan(Math.max(...equipment.map(right)))
    // Rows face the viewer, and no two components in the same row overlap.
    for (const { p } of ground) expect(p.rotY).toBe(0)
    const rows = new Map<string, typeof ground>()
    for (const g of ground) {
      const k = (g.p.position[2] - g.p.size[2] / 2).toFixed(3)
      rows.set(k, (rows.get(k) ?? []).concat([g]))
    }
    for (const row of rows.values()) {
      const sorted = row.slice().sort((a, b) => a.p.position[0] - b.p.position[0])
      for (let i = 1; i < sorted.length; i++) expect(left(sorted[i])).toBeGreaterThanOrEqual(right(sorted[i - 1]))
    }
  })

  it('moves the sun from east to west and below the horizon at night', () => {
    expect(sunDirection(7)[0]).toBeGreaterThan(sunDirection(17)[0])
    expect(sunDirection(12)[1]).toBeGreaterThan(sunDirection(7)[1])
  })
})

describe('equipment profiles', () => {
  it('every profile carries the full spec set for its type', () => {
    for (const p of PROFILES) expect(Object.keys(p.specs).sort()).toEqual(CATALOG[p.type].specs.map((s) => s[0]).sort())
  })

  it('datasheet profiles carry a source and stay unreviewed until checked', () => {
    const real = PROFILES.filter((p) => !p.example)
    expect(real.length).toBeGreaterThan(0)
    for (const p of real) {
      expect(p.source?.url).toMatch(/^https:\/\//)
      expect(p.source?.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(p.reviewed).toBe(false)
      for (const k of p.missing ?? []) expect(p.specs[k]).toBe(0)
      for (const [k, vals] of Object.entries(p.adjustable ?? {})) expect(vals).toContain(p.specs[k])
    }
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(PROFILES.length)
  })

  it('real devices become library components carrying their datasheet specs', () => {
    const devices = deviceProfiles()
    expect(devices.every((p) => !p.example)).toBe(true)
    for (const p of devices) {
      const n = makeDeviceNode(p, 0, 0)
      expect(n.type).toBe(p.type)
      expect(n.specs).toEqual(p.specs)
      expect(n.profile).toBe(p.id)
      expect(nodeTitle(n)).toBe(`${p.brand} ${p.model}`)
    }
    expect(nodeTitle(makeNode('pv', 0, 0))).toBe(CATALOG.pv.name)
  })

  it('device photos belong to real devices and exist in public/', () => {
    const files = Object.keys(import.meta.glob('/public/devices/*.jpg'))
    for (const [id, img] of Object.entries(DEVICE_IMAGES)) {
      expect(profileById(id)?.example, id).toBe(false)
      expect(files, img.file).toContain(`/public/${img.file}`)
      expect(img.sourcePage).toMatch(/^https:\/\//)
    }
  })

  it('generic component photos are openly licensed, credited and present', () => {
    const files = Object.keys(import.meta.glob('/public/components/*.jpg'))
    for (const [type, img] of Object.entries(COMPONENT_IMAGES)) {
      expect(CATALOG[type as keyof typeof CATALOG], type).toBeDefined()
      expect(files, img.file).toContain(`/public/${img.file}`)
      if (!img.source) expect(img.filePage).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
      else expect(img.filePage).toMatch(/^https:\/\//)
      expect(img.author.length).toBeGreaterThan(0)
      expect(img.license).toMatch(/^(CC0|CC BY(-SA)? \d\.\d|Public domain)/)
    }
  })

  it('installer settings keep the device profile', () => {
    const p = profileById('hyb-deye-sun-5k-sg04lp1')!
    expect(matchesProfile({ ...p.specs, reserveSoc: 50, exportLimit: 0 }, p)).toBe(true)
    expect(matchesProfile({ ...p.specs, ratedP: 6000 }, p)).toBe(false)
    expect(profileSpecs(p, { ...p.specs, reserveSoc: 50 }).reserveSoc).toBe(50)
  })

  it.each(['hyb-deye-sun-5k-sg04lp1', 'hyb-srne-hf4850s80-h'])('%s runs the 48 V hybrid template without critical findings', (id) => {
    const { nodes, wires } = hybridProject()
    const p = profileById(id)!
    const placed = nodes.map((n) => (n.type === 'hyb' ? { ...n, specs: { ...p.specs }, profile: p.id } : n))
    const v = validate(placed, wires)
    expect(v.issues.filter((i) => i.sev === 'critical')).toEqual([])
    const m = compute({ ...freshSim(), t: 12 }, v, 85)
    expect(m.ac.hybMode).not.toBe('off')
    if (p.specs.exportLimit === 0) expect(m.ac.pgrid).toBeGreaterThanOrEqual(0)
  })

  it('an adjustable spec keeps the profile and survives re-applying it', () => {
    const p = profileById('mppt-epever-xtra4415n')!
    expect(matchesProfile({ ...p.specs, nomV: 24 }, p)).toBe(true)
    expect(matchesProfile({ ...p.specs, nomV: 30 }, p)).toBe(false)
    expect(profileSpecs(p, { ...p.specs, nomV: 24 }).nomV).toBe(24)
    expect(profileSpecs(p, { ...p.specs, nomV: 30 }).nomV).toBe(48)
  })

  it('two 12.8 V example batteries in series match a 24 V controller', () => {
    const p = profileById('bat-generic-12-100')!
    const bat = (id: string) => ({ ...makeNode('bat', 0, 0, id), specs: { ...p.specs }, profile: p.id, ver: p.ver })
    const nodes = [makeNode('mppt', 0, 0, 'cc'), bat('b1'), bat('b2')]
    const w = (id: string, an: string, at: string, bn: string, bt: string): Wire => ({ id, a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: '16' })
    const v = validate(nodes, [w('1', 'cc', 'bp', 'b1', 'p'), w('2', 'b1', 'n', 'b2', 'p'), w('3', 'b2', 'n', 'cc', 'bn')])
    expect(v.sys.bank?.nomV).toBe(25.6)
    expect(v.issues.map((i) => i.rule)).not.toContain('RAT-002')
  })
})

import { routeCable } from './layout3d'

describe('3D cable routing', () => {
  const routes = (env: 'lab' | 'rooftop') => {
    const { nodes, wires } = sampleProject()
    const l = layout3d(nodes, env)
    const nm = Object.fromEntries(nodes.map((n) => [n.id, n]))
    return wires.map((w, i) => {
      const a = terminalPos3d(nm[w.a.n], w.a.t, l.placements[w.a.n])
      const b = terminalPos3d(nm[w.b.n], w.b.t, l.placements[w.b.n])
      return { a, b, pts: routeCable(a, b, (i % 11) - 5, l), l }
    })
  }

  it.each(['lab', 'rooftop'] as const)('runs orthogonally from terminal to terminal above the floor (%s)', (env) => {
    for (const { a, b, pts } of routes(env)) {
      expect(pts[0]).toEqual(a)
      expect(pts[pts.length - 1]).toEqual(b)
      for (let i = 1; i < pts.length; i++) {
        const changed = [0, 1, 2].filter((k) => Math.abs(pts[i][k] - pts[i - 1][k]) > 1e-6)
        expect(changed.length).toBe(1)
      }
      expect(Math.min(...pts.map((p) => p[1]))).toBeGreaterThanOrEqual(0)
    }
  })

  it('feeds ceiling lights from the ceiling tray', () => {
    const { nodes, wires } = sampleProject()
    const l = layout3d(nodes, 'lab')
    const w = wires.find((x) => x.b.n === 'ld1')!
    const nm = Object.fromEntries(nodes.map((n) => [n.id, n]))
    const pts = routeCable(terminalPos3d(nm[w.a.n], w.a.t, l.placements[w.a.n]), terminalPos3d(nm['ld1'], w.b.t, l.placements['ld1']), 0, l)
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(l.ceilingY)
  })
})
