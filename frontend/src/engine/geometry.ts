import { CATALOG, isBattery, isPv } from './catalog'
import type { LabNode, Rotation, TerminalType } from './types'

/** Card width at 0°/180°. */
export const NODE_W = 176
const HEADER_H = 58
const ROW_H = 22
/** Rotated (90°/270°) cards: terminal column width and the label band above/below the header. */
const COL_W = 60
const BAND_H = 28
/** Height of the name/spec header block. */
export const HEADER_BLOCK_H = 48

/** Edge a terminal sits on: Left, Right, Top or Bottom. */
export type Side = 'L' | 'R' | 'T' | 'B'

export interface ResolvedTerminal {
  id: string
  label: string
  t: TerminalType
  side: Side
  /** Position along its edge (row at 0°/180°, column at 90°/270°). */
  idx: number
}

export const rotationOf = (node: Pick<LabNode, 'rot'>): Rotation => node.rot ?? 0
/** 90° and 270° cards are laid out with terminals on the top and bottom edges. */
export const isVertical = (node: Pick<LabNode, 'rot'>) => rotationOf(node) % 180 === 90
export const nextRotation = (r: Rotation | undefined): Rotation => (((r ?? 0) + 90) % 360) as Rotation

/** Edge for the catalog's left (`L`) or right (`R`) terminal list at the node's rotation (clockwise). */
function sideFor(def: 'L' | 'R', rot: Rotation): Side {
  const order: Side[] = def === 'L' ? ['L', 'T', 'R', 'B'] : ['R', 'B', 'L', 'T']
  return order[rot / 90]
}

export function terminal(node: LabNode, tid: string): ResolvedTerminal | null {
  const def = CATALOG[node.type]
  let arr = def.L
  let list: 'L' | 'R' = 'L'
  let i = arr.findIndex((t) => t[0] === tid)
  if (i < 0) {
    arr = def.R
    list = 'R'
    i = arr.findIndex((t) => t[0] === tid)
  }
  if (i < 0) return null
  return { id: tid, label: arr[i][1], t: arr[i][2], side: sideFor(list, rotationOf(node)), idx: i }
}

/** Card size on the sheet. */
export function nodeSize(node: LabNode): { w: number; h: number } {
  const def = CATALOG[node.type]
  const n = Math.max(def.L.length, def.R.length, 1)
  if (isVertical(node)) return { w: Math.max(NODE_W, n * COL_W + 16), h: BAND_H + HEADER_BLOCK_H + BAND_H }
  return { w: NODE_W, h: HEADER_H + n * ROW_H + 6 }
}

export const nodeWidth = (node: LabNode) => nodeSize(node).w
export const nodeHeight = (node: LabNode) => nodeSize(node).h

/** Top of the name/spec header block inside the card. */
export const headerTop = (node: LabNode) => (isVertical(node) ? BAND_H : 0)

export function terminalTop(idx: number) {
  return HEADER_H + idx * ROW_H
}

/** Terminal connection point relative to the card's top-left corner, plus the outward direction. */
export function terminalLocal(node: LabNode, tid: string): { x: number; y: number; dx: number; dy: number } | null {
  const t = terminal(node, tid)
  if (!t) return null
  const { w, h } = nodeSize(node)
  if (t.side === 'L' || t.side === 'R') return { x: t.side === 'L' ? 0 : w, y: HEADER_H + t.idx * ROW_H + 8, dx: t.side === 'L' ? -1 : 1, dy: 0 }
  const def = CATALOG[node.type]
  const count = (sideFor('L', rotationOf(node)) === t.side ? def.L : def.R).length
  const x = (w - count * COL_W) / 2 + t.idx * COL_W + COL_W / 2
  return { x, y: t.side === 'T' ? 0 : h, dx: 0, dy: t.side === 'T' ? -1 : 1 }
}

export interface TerminalPoint {
  x: number
  y: number
  /** Unit direction the wire leaves the terminal in: (−1,0) left, (1,0) right, (0,−1) up, (0,1) down. */
  dx: number
  dy: number
}

export function terminalPos(node: LabNode, tid: string): TerminalPoint {
  const p = terminalLocal(node, tid)!
  return { x: node.x + p.x, y: node.y + p.y, dx: p.dx, dy: p.dy }
}

/** Column width used for terminal labels on rotated (90°/270°) cards. */
export const VERTICAL_COL_W = COL_W

export function terminalName(node: LabNode, tid: string) {
  const t = terminal(node, tid)
  return CATALOG[node.type].name + ' ' + (t ? t.label : tid)
}

export type WireStyle = 'orthogonal' | 'curved'

const STUB = 20

/**
 * Axis the wire's adjustable middle segment moves along: 'x' when the route leaves `a`
 * horizontally (a vertical middle segment that slides left/right), 'y' otherwise.
 */
export const bendAxis = (a: TerminalPoint): 'x' | 'y' => (a.dy === 0 ? 'x' : 'y')

/**
 * Wire path between two terminals. `bend` moves the middle segment along `bendAxis` (world units),
 * so overlapping wires can be separated; 0 gives the default route.
 */
export function wirePath(a: TerminalPoint, b: TerminalPoint, style: WireStyle, bend = 0) {
  const aH = a.dy === 0
  const bH = b.dy === 0
  if (style === 'curved') {
    const [c1, c2] = curveControls(a, b, bend)
    return `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`
  }
  const p1 = { x: a.x + a.dx * STUB, y: a.y + a.dy * STUB }
  const p2 = { x: b.x + b.dx * STUB, y: b.y + b.dy * STUB }
  let mid: string
  if (aH && bH) {
    const mx = (p1.x + p2.x) / 2 + bend
    mid = `L${mx},${a.y} L${mx},${b.y}`
  } else if (!aH && !bH) {
    const my = (p1.y + p2.y) / 2 + bend
    mid = `L${a.x},${my} L${b.x},${my}`
  } else if (aH) mid = bend ? `L${p2.x + bend},${p1.y} L${p2.x + bend},${p2.y}` : `L${p2.x},${p1.y}`
  else mid = bend ? `L${p1.x},${p2.y + bend} L${p2.x},${p2.y + bend}` : `L${p1.x},${p2.y}`
  return `M${a.x},${a.y} L${p1.x},${p1.y} ${mid} L${p2.x},${p2.y} L${b.x},${b.y}`
}

function curveControls(a: TerminalPoint, b: TerminalPoint, bend: number) {
  const aH = a.dy === 0
  const bH = b.dy === 0
  const ca = Math.max(40, (aH ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)) / 2)
  const cb = Math.max(40, (bH ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)) / 2)
  const sx = aH ? bend : 0
  const sy = aH ? 0 : bend
  return [
    { x: a.x + a.dx * ca + sx, y: a.y + a.dy * ca + sy },
    { x: b.x + b.dx * cb + sx, y: b.y + b.dy * cb + sy },
  ]
}

/** The adjustable middle segment of an orthogonal route (endpoints in world units). */
function bendSegment(a: TerminalPoint, b: TerminalPoint, bend: number) {
  const p1 = { x: a.x + a.dx * STUB, y: a.y + a.dy * STUB }
  const p2 = { x: b.x + b.dx * STUB, y: b.y + b.dy * STUB }
  const aH = a.dy === 0
  const bH = b.dy === 0
  if (aH && bH) {
    const x = (p1.x + p2.x) / 2 + bend
    return { x1: x, y1: a.y, x2: x, y2: b.y }
  }
  if (!aH && !bH) {
    const y = (p1.y + p2.y) / 2 + bend
    return { x1: a.x, y1: y, x2: b.x, y2: y }
  }
  if (aH) return { x1: p2.x + bend, y1: p1.y, x2: p2.x + bend, y2: p2.y }
  return { x1: p1.x, y1: p2.y + bend, x2: p2.x, y2: p2.y + bend }
}

export function wireMidpoint(a: TerminalPoint, b: TerminalPoint, style: WireStyle, bend = 0) {
  if (style === 'curved') return wireHandle(a, b, style, bend)
  const p1 = { x: a.x + a.dx * STUB, y: a.y + a.dy * STUB }
  const p2 = { x: b.x + b.dx * STUB, y: b.y + b.dy * STUB }
  const aH = a.dy === 0
  const bH = b.dy === 0
  if (aH && bH) return { x: (p1.x + p2.x) / 2 + bend, y: (a.y + b.y) / 2 }
  if (!aH && !bH) return { x: (a.x + b.x) / 2, y: (p1.y + p2.y) / 2 + bend }
  return aH ? { x: p2.x + bend, y: p1.y } : { x: p1.x, y: p2.y + bend }
}

/** Where the drag handle for the middle segment sits: its centre (the curve's midpoint when curved). */
export function wireHandle(a: TerminalPoint, b: TerminalPoint, style: WireStyle, bend = 0) {
  if (style === 'curved') {
    const [c1, c2] = curveControls(a, b, bend)
    return { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 }
  }
  const g = bendSegment(a, b, bend)
  return { x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2 }
}

/** Gap between automatically separated parallel wires. */
export const WIRE_LANE = 10
const LANE_TRIES = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]

export interface WireRoute {
  a: TerminalPoint
  b: TerminalPoint
  /** Middle-segment offset in use: the wire's own `bend`, or the automatic lane. */
  bend: number
  axis: 'x' | 'y'
  d: string
  mid: { x: number; y: number }
  handle: { x: number; y: number }
}

/**
 * Routes for every drawable wire. Wires without a manual `bend` whose middle segments would lie
 * on top of another wire's (same axis, overlapping run, closer than a lane) are moved to the
 * nearest free lane, in wire order, so parallel runs stay apart. Deterministic; display only.
 */
export function wireRoutes(wires: readonly { id: string; a: { n: string; t: string }; b: { n: string; t: string }; bend?: number }[], nm: Record<string, LabNode>, style: WireStyle): Record<string, WireRoute> {
  type Seg = { axis: 'x' | 'y'; c: number; lo: number; hi: number }
  const ends = wires.flatMap((w) => {
    const na = nm[w.a.n]
    const nb = nm[w.b.n]
    if (!na || !nb || !terminal(na, w.a.t) || !terminal(nb, w.b.t)) return []
    return [{ w, a: terminalPos(na, w.a.t), b: terminalPos(nb, w.b.t) }]
  })
  const segOf = (a: TerminalPoint, b: TerminalPoint, bend: number): Seg | null => {
    const g = bendSegment(a, b, bend)
    const axis = bendAxis(a)
    const [lo, hi] = axis === 'x' ? [Math.min(g.y1, g.y2), Math.max(g.y1, g.y2)] : [Math.min(g.x1, g.x2), Math.max(g.x1, g.x2)]
    // A zero-length middle segment (a straight wire) has nothing to separate.
    return hi - lo < 1 ? null : { axis, c: axis === 'x' ? g.x1 : g.y1, lo, hi }
  }
  const placed: Seg[] = []
  const clash = (s: Seg) => placed.some((o) => o.axis === s.axis && Math.abs(o.c - s.c) < WIRE_LANE - 0.5 && s.lo < o.hi - 0.5 && o.lo < s.hi - 0.5)
  const bends: Record<string, number> = {}
  for (const e of ends)
    if (e.w.bend !== undefined) {
      bends[e.w.id] = e.w.bend
      const s = segOf(e.a, e.b, e.w.bend)
      if (s) placed.push(s)
    }
  for (const e of ends) {
    if (e.w.bend !== undefined) continue
    let bend = 0
    const base = style === 'orthogonal' ? segOf(e.a, e.b, 0) : null
    if (base) {
      const k = LANE_TRIES.find((n) => !clash({ ...base, c: base.c + n * WIRE_LANE })) ?? 0
      bend = k * WIRE_LANE
      placed.push({ ...base, c: base.c + bend })
    }
    bends[e.w.id] = bend
  }
  const out: Record<string, WireRoute> = {}
  for (const { w, a, b } of ends) {
    const bend = bends[w.id]
    out[w.id] = { a, b, bend, axis: bendAxis(a), d: wirePath(a, b, style, bend), mid: wireMidpoint(a, b, style, bend), handle: wireHandle(a, b, style, bend) }
  }
  return out
}

/** Top-left position that keeps a card's centre in place when its size changes (e.g. on rotation). */
export function keepCentre(before: LabNode, after: LabNode) {
  const a = nodeSize(before)
  const b = nodeSize(after)
  return { x: before.x + (a.w - b.w) / 2, y: before.y + (a.h - b.h) / 2 }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Short spec line shown under the component name. */
export function subText(node: LabNode) {
  const s = node.specs
  if (isPv(node)) return `${s.ratedPower} W · Voc ${s.voc} V`
  if (isBattery(node)) return `${s.nomV} V · ${s.ah} Ah`
  switch (node.type) {
    case 'mppt':
    case 'pwm':
      return `${s.maxI} A · ${s.maxPvV} V max`
    case 'dcb':
      return `2P · ${s.ratedI} A`
    case 'inv':
      return `${s.ratedP / 1000} kW · ${s.nomV} V DC`
    case 'outlet':
      return `Duplex · ${s.ratedI} A · ${s.maxV} V`
    case 'acdb':
      return `2-way · ${s.ratedI} A`
    case 'gnd':
      return `${s.res} Ω`
    case 'gti':
      return `${s.ratedP / 1000} kW · ${s.minPvV}–${s.maxPvV} V PV`
    case 'hyb':
      return `${s.ratedP / 1000} kW · ${s.nomV} V battery`
    case 'grid':
      return `${s.acV} V · ${s.serviceA} A service`
    case 'nm':
      return `Import / export · ${s.ratedI} A`
    case 'gen':
      return `${s.ratedP / 1000} kW · auto ${s.startSoc}–${s.stopSoc}%`
    case 'ats':
      return `Main / backup · ${s.ratedI} A`
    case 'mc4':
    case 'ybr':
    case 'dbus':
    case 'dcm':
      return `${s.ratedI} A · ${s.maxV} V`
    case 'cbx':
      return `3 strings · ${s.fuseA} A fuses`
    case 'fuse':
      return `${s.ratedI} A · ${s.maxV} V DC`
    case 'iso':
    case 'acsw':
      return `${s.closed === 0 ? 'OPEN' : 'Closed'} · ${s.ratedI} A`
    case 'mcb':
    case 'mccb':
      return `${s.closed === 0 ? 'OFF' : 'ON'} · ${s.ratedI} A`
    case 'rccb':
      return `${s.closed === 0 ? 'OFF' : 'ON'} · ${s.ratedI} A · ${s.rcd} mA`
    case 'dspd':
    case 'aspd':
      return `Uc ${s.maxV} V · ${s.imax} kA`
    case 'pebar':
      return `6-way · ${s.csa} mm²`
    case 'acm':
      return `kWh · ${s.ratedI} A`
    case 'mi':
      return `${s.ratedP} W · ${s.minPvV}–${s.maxPvV} V PV`
    default:
      return `${s.p} W · ${pad2(s.on)}:00–${pad2(s.off)}:00`
  }
}
