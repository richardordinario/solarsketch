/**
 * Pure 3D placement for the Virtual Lab. Maps the 2D sheet into metres so the 3D view is a
 * spatial view of the same project; it contains no electrical behaviour (PRD §3.4).
 */
import { CATALOG, LOAD_TYPES, isPv } from './catalog'
import { terminal } from './geometry'
import type { ComponentType, LabNode } from './types'

export type Environment3D = 'lab' | 'rooftop'
export type Vec3 = [number, number, number]

/** Box size of each component in metres: width, height, depth. */
export const SIZE: Record<ComponentType, Vec3> = {
  pv: [1.72, 0.04, 1.13],
  pvpoly: [1.65, 0.04, 0.99],
  pvbif: [1.9, 0.035, 1.13],
  pvflex: [1.05, 0.01, 0.54],
  pvport: [1.0, 0.03, 0.7],
  batfla: [0.33, 0.24, 0.17],
  batagm: [0.33, 0.22, 0.17],
  batgel: [0.33, 0.22, 0.17],
  batnmc: [0.45, 0.2, 0.4],
  mppt: [0.3, 0.38, 0.15],
  pwm: [0.22, 0.28, 0.1],
  bat: [0.52, 0.3, 0.36],
  dcb: [0.12, 0.18, 0.1],
  inv: [0.45, 0.55, 0.2],
  acdb: [0.4, 0.45, 0.12],
  outlet: [0.12, 0.12, 0.04],
  gnd: [0.04, 1.2, 0.04],
  led: [0.3, 0.12, 0.3],
  fan: [0.45, 1.1, 0.35],
  fridge: [0.6, 1.6, 0.62],
  tv: [1.0, 0.6, 0.06],
  gti: [0.42, 0.5, 0.18],
  hyb: [0.5, 0.65, 0.22],
  grid: [0.25, 6, 0.25],
  nm: [0.18, 0.28, 0.12],
  gen: [0.75, 0.55, 0.55],
  ats: [0.3, 0.4, 0.14],
  acw: [0.47, 0.35, 0.55],
  acs: [0.8, 0.28, 0.2],
  pc: [0.55, 0.45, 0.4],
  laptop: [0.36, 0.25, 0.25],
  router: [0.2, 0.04, 0.14],
  rice: [0.28, 0.25, 0.28],
  kettle: [0.2, 0.25, 0.15],
  micro: [0.45, 0.26, 0.35],
  induc: [0.3, 0.06, 0.36],
  wash: [0.75, 0.9, 0.45],
  iron: [0.26, 0.14, 0.11],
  pump: [0.4, 0.25, 0.2],
  mc4: [0.14, 0.03, 0.06],
  ybr: [0.12, 0.04, 0.1],
  cbx: [0.3, 0.35, 0.14],
  fuse: [0.1, 0.06, 0.08],
  iso: [0.1, 0.14, 0.1],
  dspd: [0.054, 0.09, 0.07],
  mcb: [0.018, 0.09, 0.07],
  mccb: [0.08, 0.15, 0.09],
  rccb: [0.036, 0.09, 0.07],
  aspd: [0.036, 0.09, 0.07],
  acsw: [0.12, 0.16, 0.1],
  dbus: [0.28, 0.06, 0.08],
  pebar: [0.16, 0.03, 0.03],
  dcm: [0.1, 0.06, 0.04],
  acm: [0.036, 0.09, 0.07],
  mi: [0.21, 0.18, 0.04],
}

/** Equipment that sits on a bench (top at BENCH_H) rather than on the floor. */
export const ON_BENCH: ComponentType[] = ['mppt', 'pwm', 'dcb', 'inv', 'acdb', 'tv', 'gti', 'hyb', 'nm', 'ats', 'pc', 'laptop', 'router', 'rice', 'kettle', 'micro', 'induc', 'iron', 'mc4', 'ybr', 'cbx', 'fuse', 'iso', 'dspd', 'mcb', 'mccb', 'rccb', 'aspd', 'acsw', 'dbus', 'pebar', 'dcm', 'acm', 'mi']
export const BENCH_H = 0.8
/** PV tilt from horizontal, radians. */
export const PV_TILT = (15 * Math.PI) / 180
const SCALE = 1 / 100
const ROOF_H = 3.2

export interface Placement {
  id: string
  type: ComponentType
  /** Centre of the component body, metres. */
  position: Vec3
  /** Rotation about Y, radians: the 2D sheet's clockwise rotation (180° faces the other way). */
  rotY: number
  size: Vec3
  /** Whether the body sits on a bench. */
  bench: boolean
}

export interface Layout3D {
  placements: Record<string, Placement>
  /** Floor extents [minX, maxX, minZ, maxZ]. */
  bounds: [number, number, number, number]
  center: Vec3
  env: Environment3D
  /** Floor cable trunking: height and the z of its centre line (in front of the equipment). */
  trayY: number
  trayZ: number
  /** Ceiling tray height, used by cables to ceiling-mounted loads. */
  ceilingY: number
  /** Rooftop only: z of the house front wall that roof cables run down. */
  wallZ: number | null
}

function centerOf(nodes: LabNode[]) {
  if (!nodes.length) return { cx: 0, cy: 0 }
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  return { cx: (Math.min(...xs) + Math.max(...xs) + 176) / 2, cy: (Math.min(...ys) + Math.max(...ys) + 100) / 2 }
}

export function layout3d(nodes: LabNode[], env: Environment3D): Layout3D {
  const { cx, cy } = centerOf(nodes)
  const placements: Record<string, Placement> = {}
  const pvs = nodes.filter(isPv)

  for (const n of nodes) {
    const size = SIZE[n.type]
    let x = (n.x + 88 - cx) * SCALE * 1.4
    let z = (n.y + 40 - cy) * SCALE * 1.4
    let y: number
    const bench = ON_BENCH.includes(n.type)
    if (isPv(n)) {
      if (env === 'rooftop') {
        // Modules in a grid on the roof, in 2D order.
        const i = pvs.indexOf(n)
        const cols = Math.max(1, Math.ceil(Math.sqrt(pvs.length)))
        x = (i % cols) * 1.85 - ((cols - 1) * 1.85) / 2
        z = -2.6 + Math.floor(i / cols) * 1.25
        y = ROOF_H + 0.9 + Math.floor(i / cols) * -0.33
      } else y = 0.75
    } else if (n.type === 'led') y = 2.5
    else if (n.type === 'gnd') y = size[1] / 2 - 0.9
    else if (n.type === 'outlet') y = 0.4
    // Aircons are mounted high: a split indoor unit near the ceiling, a window unit in a wall opening.
    else if (n.type === 'acs') y = 2.2
    else if (n.type === 'acw') y = 1.3
    else y = bench ? BENCH_H + size[1] / 2 : size[1] / 2
    placements[n.id] = { id: n.id, type: n.type, position: [x, y, z], rotY: -((n.rot ?? 0) * Math.PI) / 180, size, bench }
  }

  if (env === 'rooftop') placeRooftopEquipment(nodes, placements)

  const all = Object.values(placements)
  const xs = all.map((p) => p.position[0])
  const zs = all.map((p) => p.position[2])
  const bounds: Layout3D['bounds'] = all.length ? [Math.min(...xs) - 2, Math.max(...xs) + 2, Math.min(...zs) - 2, Math.max(...zs) + 2] : [-4, 4, -4, 4]
  const center: Vec3 = [(bounds[0] + bounds[1]) / 2, env === 'rooftop' ? 1.6 : 0.6, (bounds[2] + bounds[3]) / 2]
  const ground = all.filter((p) => !isPv(p) && p.type !== 'led')
  const trayZ = (ground.length ? Math.max(...ground.map((p) => p.position[2] + p.size[2] / 2)) : 0) + 0.7
  return { placements, bounds, center, env, trayY: 0.05, trayZ, ceilingY: 2.85, wallZ: env === 'rooftop' ? -0.1 : null }
}

/** Rooftop house front face (the house box in lab-3d.tsx `Room`: centre z −2.4, depth 4.4). */
export const HOUSE_FRONT_Z = -0.2
/** Loads mounted on the house wall in the rooftop scene; every other load stands on the ground. */
const WALL_LOADS: ComponentType[] = ['tv', 'acs', 'acw', 'led', 'outlet']
const WALL_LOAD_Y: Partial<Record<ComponentType, number>> = { led: 2.3, acs: 2.2, acw: 1.3, tv: 1.4, outlet: 0.4 }
/** Centre height of wall-mounted equipment (controllers, inverters, boards, protection). */
const WALL_MOUNT_Y = 1.4
const ROW_GAP = 0.3
/** The ground row stands this far in front of the wall, clear of the wall row's cable drops. */
const GROUND_ROW_Z = HOUSE_FRONT_Z + 0.9
/** Space between the equipment area and the loads area. */
const AREA_GAP = 1.2

/**
 * Rooftop scene: everything except the PV array is set out in front of the house, never inside it,
 * in straight rows facing the viewer. Equipment comes first (wall-mounted gear on the wall, batteries,
 * generator, grid and ground rod on the ground in front), and all loads are grouped to the right.
 * Rows keep the 2D left-to-right order, and the whole set is centred under the array.
 */
function placeRooftopEquipment(nodes: LabNode[], placements: Record<string, Placement>) {
  const byX = nodes.filter((n) => !isPv(n)).sort((a, b) => a.x - b.x || a.y - b.y)
  const isLoad = (n: LabNode) => LOAD_TYPES.includes(n.type) || n.type === 'outlet'
  const areas = [byX.filter((n) => !isLoad(n)), byX.filter(isLoad)]
  let start = 0
  let end = 0
  for (const area of areas) {
    if (!area.length) continue
    const wall = area.filter((n) => (isLoad(n) ? WALL_LOADS.includes(n.type) : ON_BENCH.includes(n.type)))
    const ground = area.filter((n) => !wall.includes(n))
    let width = 0
    for (const [row, onWall] of [[wall, true], [ground, false]] as const) {
      let x = start
      for (const n of row) {
        const size = SIZE[n.type]
        const y = onWall ? (WALL_LOAD_Y[n.type] ?? WALL_MOUNT_Y) : n.type === 'gnd' ? size[1] / 2 - 0.9 : size[1] / 2
        const z = onWall ? HOUSE_FRONT_Z + size[2] / 2 + 0.02 : GROUND_ROW_Z + size[2] / 2
        placements[n.id] = { ...placements[n.id], position: [x + size[0] / 2, y, z], rotY: 0, bench: false }
        x += size[0] + ROW_GAP
      }
      width = Math.max(width, x - ROW_GAP - start)
    }
    end = start + width
    start = end + AREA_GAP
  }
  const shift = -end / 2
  for (const n of byX) placements[n.id].position[0] += shift
}

/**
 * World position of a terminal. Terminals sit along the component's front face (or the back of a
 * PV module's junction box), left-side terminals first, so cables leave from visible points.
 */
export function terminalPos3d(node: LabNode, tid: string, p: Placement): Vec3 {
  const def = CATALOG[node.type]
  const all = def.L.concat(def.R)
  const idx = all.findIndex((t) => t[0] === tid)
  const t = terminal(node, tid)
  const count = all.length
  const [w, h, d] = p.size
  let local: Vec3
  if (isPv(node)) {
    // Leads hang below the module's lower edge.
    local = [(idx - (count - 1) / 2) * 0.12, -0.35, d / 2 - 0.05]
  } else if (node.type === 'gnd') {
    local = [0, h / 2 - 0.05, 0.03]
  } else if (node.type === 'led') {
    local = [(idx - (count - 1) / 2) * 0.06, h / 2 + 0.05, 0]
  } else {
    const span = Math.min(w * 0.8, 0.07 * Math.max(1, count - 1))
    const fx = count > 1 ? -span / 2 + (span * idx) / (count - 1) : 0
    local = [fx, -h / 2 + Math.min(0.06, h * 0.2), d / 2 + 0.01]
  }
  // Rotated components turn their terminals with them (about Y, matching the mesh rotation).
  if (t && p.rotY) {
    const c = Math.cos(p.rotY)
    const s = Math.sin(p.rotY)
    local = [local[0] * c + local[2] * s, local[1], -local[0] * s + local[2] * c]
  }
  return [p.position[0] + local[0], p.position[1] + local[1], p.position[2] + local[2]]
}

/** Catenary-like control points for a cable between two terminals. */
export function cablePoints(a: Vec3, b: Vec3): Vec3[] {
  const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const low = Math.min(a[1], b[1]) - 0.15 - Math.min(0.6, dist * 0.08)
  const floor = 0.03
  const sagY = Math.max(floor, low)
  return [a, [a[0], Math.max(floor, a[1] - 0.12), a[2] + 0.06], [(a[0] + b[0]) / 2, sagY, (a[2] + b[2]) / 2 + 0.05], [b[0], Math.max(floor, b[1] - 0.12), b[2] + 0.06], b]
}

/** Cables leave and enter terminals this far in front of the face. */
const STANDOFF = 0.12
const LANE_GAP = 0.035
/** Endpoints above this height are fed from the ceiling tray instead of the floor trunking. */
const HIGH = 1.8

/**
 * Orthogonal cable route between two terminals, the way an installer would run it: out from the
 * terminal, down (or up) to the floor trunking or ceiling tray, along it in its own lane, and back
 * up to the other terminal. Roof cables first run down the house front wall. Every segment is
 * axis-aligned; consecutive duplicate points are removed.
 */
export function routeCable(a: Vec3, b: Vec3, lane: number, layout: Layout3D): Vec3[] {
  const ceiling = layout.env === 'lab' && (a[1] > HIGH || b[1] > HIGH)
  const level = ceiling ? layout.ceilingY : layout.trayY
  const z = layout.trayZ + lane * LANE_GAP
  const leg = (p: Vec3): Vec3[] => {
    const out: Vec3 = [p[0], p[1], p[2] + STANDOFF]
    if (layout.wallZ !== null && p[1] > 2.5) {
      // Roof: run along the roof to the wall, then down the wall.
      return [p, out, [p[0], p[1], layout.wallZ], [p[0], level, layout.wallZ], [p[0], level, z]]
    }
    return [p, out, [out[0], level, out[2]], [out[0], level, z]]
  }
  const pts = [...leg(a), ...leg(b).reverse()]
  return pts.filter((p, i) => i === 0 || p.some((v, k) => Math.abs(v - pts[i - 1][k]) > 1e-6))
}

/** Sun direction for the simulated hour (east at 06:00, overhead at noon, west at 18:00). */
export function sunDirection(hour: number): Vec3 {
  const day = hour > 6 && hour < 18
  if (!day) return [0.3, 0.6, -0.7]
  const a = (Math.PI * (hour - 6)) / 12
  return [Math.cos(a) * 8, Math.sin(a) * 9 + 0.5, 3]
}
