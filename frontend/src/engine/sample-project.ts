import { CATALOG, isBattery, isPv, makeNode } from './catalog'
import type { ComponentType, LabNode, Wire } from './types'

export const SAMPLE_PROJECT_NAME = 'Off-grid 0.8 kWp · Training House'

/** Seed project: 2S PV string → MPPT → LiFePO4 → breaker → inverter → AC board → loads, with earthing. */
export function sampleProject(): { nodes: LabNode[]; wires: Wire[] } {
  const layout: [string, ComponentType, number, number][] = [
    ['pv1', 'pv', 40, 40],
    ['pv2', 'pv', 40, 200],
    ['cc1', 'mppt', 300, 110],
    ['bat1', 'bat', 570, 40],
    ['dcb1', 'dcb', 570, 220],
    ['inv1', 'inv', 820, 150],
    ['db1', 'acdb', 1080, 150],
    ['ld1', 'led', 1360, 90],
    ['ld2', 'fridge', 1360, 250],
    ['g1', 'gnd', 1080, 380],
  ]
  const nodes = layout.map(([id, type, x, y]) => makeNode(type, x, y, id))

  const links: [string, string, string, string, number][] = [
    ['pv1', 'p', 'cc1', 'pvp', 6],
    ['pv1', 'n', 'pv2', 'p', 6],
    ['pv2', 'n', 'cc1', 'pvn', 6],
    ['cc1', 'bp', 'bat1', 'p', 16],
    ['cc1', 'bn', 'bat1', 'n', 16],
    ['bat1', 'p', 'dcb1', 'i', 25],
    ['dcb1', 'o', 'inv1', 'dp', 25],
    ['bat1', 'n', 'inv1', 'dn', 50],
    ['inv1', 'l', 'db1', 'l', 4],
    ['inv1', 'n', 'db1', 'n', 4],
    ['db1', 'pe', 'g1', 'pe', 6],
    ['db1', 'l1', 'ld1', 'l', 2.5],
    ['db1', 'n1', 'ld1', 'n', 2.5],
    ['db1', 'l2', 'ld2', 'l', 2.5],
    ['db1', 'n2', 'ld2', 'n', 2.5],
    // Equipment bonding: PV frames, controller case and battery enclosure to earth.
    ['pv1', 'pe', 'g1', 'pe', 6],
    ['pv2', 'pe', 'g1', 'pe', 6],
    ['cc1', 'pe', 'g1', 'pe', 6],
    ['bat1', 'pe', 'g1', 'pe', 6],
  ]
  const wires: Wire[] = links.map(([an, at, bn, bt, g], i) => ({ id: 'w' + (i + 1), a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: String(g) }))
  return { nodes, wires }
}

type Link = [string, string, string, string, number]
/** Equipment bonding (BND-001): PE of every PV frame, controller and battery enclosure to the rod g1. */
const bonding = (layout: [string, ComponentType, number, number][]): Link[] =>
  layout
    .filter(([, type]) => (isPv({ type }) || isBattery({ type }) || type === 'mppt' || type === 'pwm') && CATALOG[type].L.concat(CATALOG[type].R).some((t) => t[0] === 'pe'))
    .map(([id]) => [id, 'pe', 'g1', 'pe', 6])

const build = (layout: [string, ComponentType, number, number][], links: Link[], specs: Record<string, Record<string, number>> = {}) => ({
  nodes: layout.map(([id, type, x, y]) => {
    const n = makeNode(type, x, y, id)
    return specs[id] ? { ...n, specs: { ...n.specs, ...specs[id] } } : n
  }),
  wires: [...links, ...bonding(layout)].map(([an, at, bn, bt, g], i): Wire => ({ id: 'w' + (i + 1), a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: String(g) })),
})

/** Grid-tied, net-metered: 6S PV → grid-tied inverter → AC board ← net meter ← utility grid. */
export function gridTiedProject() {
  const pv: [string, ComponentType, number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [`pv${i + 1}`, 'pv', 40 + (i % 2) * 200, 40 + Math.floor(i / 2) * 150])
  return build(
    [...pv, ['gti1', 'gti', 480, 160], ['db1', 'acdb', 760, 160], ['nm1', 'nm', 760, 420], ['grid1', 'grid', 1020, 420], ['g1', 'gnd', 480, 420], ['ld1', 'led', 1040, 60], ['ld2', 'fridge', 1040, 190], ['ld3', 'tv', 1300, 60], ['ld4', 'fan', 1300, 190]],
    [
      ['pv1', 'p', 'gti1', 'pvp', 6],
      ['pv1', 'n', 'pv2', 'p', 6],
      ['pv2', 'n', 'pv3', 'p', 6],
      ['pv3', 'n', 'pv4', 'p', 6],
      ['pv4', 'n', 'pv5', 'p', 6],
      ['pv5', 'n', 'pv6', 'p', 6],
      ['pv6', 'n', 'gti1', 'pvn', 6],
      ['gti1', 'l', 'db1', 'l', 4],
      ['gti1', 'n', 'db1', 'n', 4],
      ['gti1', 'pe', 'g1', 'pe', 6],
      ['grid1', 'l', 'nm1', 'gl', 16],
      ['grid1', 'n', 'nm1', 'gn', 16],
      ['nm1', 'l', 'db1', 'l', 6],
      ['nm1', 'n', 'db1', 'n', 6],
      ['db1', 'pe', 'g1', 'pe', 6],
      ['db1', 'l1', 'ld1', 'l', 2.5],
      ['db1', 'n1', 'ld1', 'n', 2.5],
      ['db1', 'l1', 'ld3', 'l', 2.5],
      ['db1', 'n1', 'ld3', 'n', 2.5],
      ['db1', 'l2', 'ld2', 'l', 2.5],
      ['db1', 'n2', 'ld2', 'n', 2.5],
      ['db1', 'l2', 'ld4', 'l', 2.5],
      ['db1', 'n2', 'ld4', 'n', 2.5],
    ],
  )
}

/**
 * Hybrid with generator backup: 6S PV and a 51.2 V bank on a hybrid inverter; grid (through a
 * net meter) and generator feed its grid input through an automatic transfer switch.
 */
export function hybridProject() {
  const pv: [string, ComponentType, number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [`pv${i + 1}`, 'pv', 40 + (i % 2) * 200, 40 + Math.floor(i / 2) * 150])
  return build(
    [
      ...pv,
      ['bat1', 'bat', 300, 520],
      ['bat2', 'bat', 300, 680],
      ['hyb1', 'hyb', 560, 220],
      ['ats1', 'ats', 560, 560],
      ['nm1', 'nm', 820, 560],
      ['grid1', 'grid', 1080, 560],
      ['gen1', 'gen', 820, 760],
      ['db1', 'acdb', 840, 220],
      ['g1', 'gnd', 1080, 360],
      ['ld1', 'led', 1120, 60],
      ['ld2', 'fridge', 1120, 190],
      ['ld3', 'tv', 1380, 60],
      ['ld4', 'fan', 1380, 190],
    ],
    [
      ['pv1', 'p', 'hyb1', 'pvp', 6],
      ['pv1', 'n', 'pv2', 'p', 6],
      ['pv2', 'n', 'pv3', 'p', 6],
      ['pv3', 'n', 'pv4', 'p', 6],
      ['pv4', 'n', 'pv5', 'p', 6],
      ['pv5', 'n', 'pv6', 'p', 6],
      ['pv6', 'n', 'hyb1', 'pvn', 6],
      ['hyb1', 'bp', 'bat1', 'p', 35],
      ['bat1', 'n', 'bat2', 'p', 50],
      ['bat2', 'n', 'hyb1', 'bn', 35],
      ['grid1', 'l', 'nm1', 'gl', 16],
      ['grid1', 'n', 'nm1', 'gn', 16],
      ['nm1', 'l', 'ats1', 'ml', 6],
      ['nm1', 'n', 'ats1', 'mn', 6],
      ['gen1', 'l', 'ats1', 'bl', 4],
      ['gen1', 'n', 'ats1', 'bkn', 4],
      ['ats1', 'l', 'hyb1', 'gl', 4],
      ['ats1', 'n', 'hyb1', 'gn', 4],
      ['hyb1', 'l', 'db1', 'l', 4],
      ['hyb1', 'n', 'db1', 'n', 4],
      ['hyb1', 'pe', 'g1', 'pe', 6],
      ['db1', 'pe', 'g1', 'pe', 6],
      ['db1', 'l1', 'ld1', 'l', 2.5],
      ['db1', 'n1', 'ld1', 'n', 2.5],
      ['db1', 'l1', 'ld3', 'l', 2.5],
      ['db1', 'n1', 'ld3', 'n', 2.5],
      ['db1', 'l2', 'ld2', 'l', 2.5],
      ['db1', 'n2', 'ld2', 'n', 2.5],
      ['db1', 'l2', 'ld4', 'l', 2.5],
      ['db1', 'n2', 'ld4', 'n', 2.5],
    ],
  )
}

/**
 * Hybrid on the grid without a generator: 6S PV and a 51.2 V bank on a hybrid inverter, grid through
 * a net meter. `reserveSoc` sets the energy-source priority while the grid is present: a low reserve
 * gives solar → battery → grid; 100 % keeps the battery full for brownouts (solar → grid).
 */
export function hybridGridProject(reserveSoc: number) {
  const pv: [string, ComponentType, number, number][] = [0, 1, 2, 3, 4, 5].map((i) => [`pv${i + 1}`, 'pv', 40 + (i % 2) * 200, 40 + Math.floor(i / 2) * 150])
  return build(
    [
      ...pv,
      ['bat1', 'bat', 300, 520],
      ['bat2', 'bat', 300, 680],
      ['hyb1', 'hyb', 560, 220],
      ['nm1', 'nm', 560, 560],
      ['grid1', 'grid', 820, 560],
      ['db1', 'acdb', 840, 220],
      ['g1', 'gnd', 1080, 360],
      ['ld1', 'led', 1120, 60],
      ['ld2', 'fridge', 1120, 190],
      ['ld3', 'tv', 1380, 60],
      ['ld4', 'fan', 1380, 190],
    ],
    [
      ['pv1', 'p', 'hyb1', 'pvp', 6],
      ['pv1', 'n', 'pv2', 'p', 6],
      ['pv2', 'n', 'pv3', 'p', 6],
      ['pv3', 'n', 'pv4', 'p', 6],
      ['pv4', 'n', 'pv5', 'p', 6],
      ['pv5', 'n', 'pv6', 'p', 6],
      ['pv6', 'n', 'hyb1', 'pvn', 6],
      ['hyb1', 'bp', 'bat1', 'p', 35],
      ['bat1', 'n', 'bat2', 'p', 50],
      ['bat2', 'n', 'hyb1', 'bn', 35],
      ['grid1', 'l', 'nm1', 'gl', 16],
      ['grid1', 'n', 'nm1', 'gn', 16],
      ['nm1', 'l', 'hyb1', 'gl', 6],
      ['nm1', 'n', 'hyb1', 'gn', 6],
      ['hyb1', 'l', 'db1', 'l', 4],
      ['hyb1', 'n', 'db1', 'n', 4],
      ['hyb1', 'pe', 'g1', 'pe', 6],
      ['db1', 'pe', 'g1', 'pe', 6],
      ['db1', 'l1', 'ld1', 'l', 2.5],
      ['db1', 'n1', 'ld1', 'n', 2.5],
      ['db1', 'l1', 'ld3', 'l', 2.5],
      ['db1', 'n1', 'ld3', 'n', 2.5],
      ['db1', 'l2', 'ld2', 'l', 2.5],
      ['db1', 'n2', 'ld2', 'n', 2.5],
      ['db1', 'l2', 'ld4', 'l', 2.5],
      ['db1', 'n2', 'ld4', 'n', 2.5],
    ],
    { hyb1: { reserveSoc } },
  )
}

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  build: () => { nodes: LabNode[]; wires: Wire[] }
}

export const TEMPLATES: ProjectTemplate[] = [
  { id: 'off-grid', name: SAMPLE_PROJECT_NAME, description: 'Off-grid: PV, MPPT controller, 24 V LiFePO4 battery, inverter and loads.', build: sampleProject },
  { id: 'grid-tied', name: 'Grid-tied 2.4 kWp · Net-metered House', description: 'Grid-tied inverter with a net meter. Exports surplus by day, imports at night; shuts down in a brownout.', build: gridTiedProject },
  {
    id: 'hybrid-solar',
    name: 'Hybrid 2.4 kWp · Solar Priority',
    description: 'Solar first, battery next, grid as backup. The battery runs the house until it reaches the 20 % reserve, then the grid takes over.',
    build: () => hybridGridProject(20),
  },
  {
    id: 'hybrid-backup',
    name: 'Hybrid 2.4 kWp · Battery Backup Priority',
    description: 'Solar and grid for normal use. The battery stays charged (100 % reserve) and only discharges during a brownout.',
    build: () => hybridGridProject(100),
  },
  { id: 'hybrid', name: 'Hybrid 2.4 kWp · Battery and Generator Backup', description: 'Hybrid inverter with a 48 V bank, grid through a net meter, and a generator on an automatic transfer switch.', build: hybridProject },
]
