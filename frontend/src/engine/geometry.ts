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

export function wirePath(a: TerminalPoint, b: TerminalPoint, style: WireStyle) {
  const aH = a.dy === 0
  const bH = b.dy === 0
  if (style === 'curved') {
    const ca = Math.max(40, (aH ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)) / 2)
    const cb = Math.max(40, (bH ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)) / 2)
    return `M${a.x},${a.y} C${a.x + a.dx * ca},${a.y + a.dy * ca} ${b.x + b.dx * cb},${b.y + b.dy * cb} ${b.x},${b.y}`
  }
  const p1 = { x: a.x + a.dx * STUB, y: a.y + a.dy * STUB }
  const p2 = { x: b.x + b.dx * STUB, y: b.y + b.dy * STUB }
  let mid: string
  if (aH && bH) {
    const mx = (p1.x + p2.x) / 2
    mid = `L${mx},${a.y} L${mx},${b.y}`
  } else if (!aH && !bH) {
    const my = (p1.y + p2.y) / 2
    mid = `L${a.x},${my} L${b.x},${my}`
  } else if (aH) mid = `L${p2.x},${p1.y}`
  else mid = `L${p1.x},${p2.y}`
  return `M${a.x},${a.y} L${p1.x},${p1.y} ${mid} L${p2.x},${p2.y} L${b.x},${b.y}`
}

export function wireMidpoint(a: TerminalPoint, b: TerminalPoint, style: WireStyle) {
  if (style === 'curved') return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const p1 = { x: a.x + a.dx * STUB, y: a.y + a.dy * STUB }
  const p2 = { x: b.x + b.dx * STUB, y: b.y + b.dy * STUB }
  const aH = a.dy === 0
  const bH = b.dy === 0
  if (aH && bH) return { x: (p1.x + p2.x) / 2, y: (a.y + b.y) / 2 }
  if (!aH && !bH) return { x: (a.x + b.x) / 2, y: (p1.y + p2.y) / 2 }
  return aH ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y }
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
