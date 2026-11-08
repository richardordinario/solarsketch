/**
 * Standalone wiring-diagram export. Builds an SVG from project data (not the DOM) using a fixed,
 * print-friendly light palette, so exports look the same in either theme.
 */
import { CATALOG, CATALOG_VERSION, DOMAIN_LABEL, RULESET_VERSION } from '@/engine/catalog'
import { nodeTitle } from '@/engine/profiles'
import { HEADER_BLOCK_H, headerTop, isVertical, nodeSize, subText, terminal, terminalLocal, wireRoutes, type WireStyle } from '@/engine/geometry'
import type { LabNode, TerminalType, Wire } from '@/engine/types'
import { nodeMap, validate } from '@/engine/validation'

const INK = '#201e1d'
const MUTED = '#605d5d'
const RULE = '#d7d3d3'
const PAPER = '#ffffff'
const NODE_BG = '#fcfbfb'
const PRIMARY = '#ec3013'
const FONT = 'Archivo, Arial, Helvetica, sans-serif'

const TERM: Record<TerminalType, string> = { 'dc+': '#ec3013', 'dc-': '#201e1d', dc: '#605d5d', 'ac-l': '#7a4a24', 'ac-n': '#2f5fa8', pe: '#2f8a3a' }
const MANUAL: Record<string, string> = { red: '#ec3013', black: '#201e1d', brown: '#7a4a24', blue: '#2f5fa8', gy: 'gy' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface DiagramOptions {
  projectName: string
  wireStyle?: WireStyle
}

export interface DiagramSvg {
  svg: string
  width: number
  height: number
}

export function buildDiagramSvg(nodes: LabNode[], wires: Wire[], opts: DiagramOptions): DiagramSvg {
  const style = opts.wireStyle ?? 'orthogonal'
  const nm = nodeMap(nodes)
  const v = validate(nodes, wires)
  const pad = 48
  const titleH = 64
  const xs = nodes.length ? nodes.map((n) => n.x) : [0]
  const ys = nodes.length ? nodes.map((n) => n.y) : [0]
  const x0 = Math.min(...xs) - pad
  const y0 = Math.min(...ys) - pad
  const x1 = Math.max(...(nodes.length ? nodes.map((n) => n.x + nodeSize(n).w) : [400])) + pad
  const y1 = Math.max(...(nodes.length ? nodes.map((n) => n.y + nodeSize(n).h) : [200])) + pad
  const width = Math.max(640, Math.round(x1 - x0))
  const height = Math.round(y1 - y0) + titleH
  const out: string[] = []

  out.push(`<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="${PAPER}"/>`)

  // Wires first so nodes sit on top, routed exactly as on the sheet.
  const routes = wireRoutes(wires, nm, style)
  for (const w of wires) {
    const na = nm[w.a.n]
    const nb = nm[w.b.n]
    if (!na || !nb || !routes[w.id]) continue
    const d = routes[w.id].d
    const ta = terminal(na, w.a.t)!.t
    const tb = terminal(nb, w.b.t)!.t
    const ty = ta === 'dc' ? tb : ta
    const col = w.color === 'auto' ? (ty === 'pe' ? 'gy' : TERM[ty === 'dc' ? 'dc+' : ty]) : MANUAL[w.color]
    const sw = (1.5 + Math.min(3, parseFloat(w.gauge) / 14)).toFixed(2)
    const fail = v.wres[w.id]?.fail
    const dash = fail ? ' stroke-dasharray="7 5"' : ''
    out.push(`<path d="${d}" fill="none" stroke="${col === 'gy' ? TERM.pe : col}" stroke-width="${sw}" stroke-linejoin="round"${dash}/>`)
    if (col === 'gy') out.push(`<path d="${d}" fill="none" stroke="#e3c21b" stroke-width="${sw}" stroke-dasharray="6 6" stroke-linejoin="round"/>`)
  }

  for (const n of nodes) {
    const c = CATALOG[n.type]
    const title = nodeTitle(n, true)
    const { w, h } = nodeSize(n)
    const vertical = isVertical(n)
    const top = headerTop(n)
    out.push(`<g transform="translate(${n.x},${n.y})">`)
    out.push(`<rect width="${w}" height="${h}" fill="${NODE_BG}" stroke="${RULE}" stroke-width="2"/>`)
    if (vertical) out.push(`<line x1="0" y1="${top}" x2="${w}" y2="${top}" stroke="${RULE}" stroke-width="2"/>`)
    out.push(`<line x1="0" y1="${top + HEADER_BLOCK_H}" x2="${w}" y2="${top + HEADER_BLOCK_H}" stroke="${RULE}" stroke-width="2"/>`)
    out.push(`<rect x="8" y="${top + 9}" width="38" height="30" fill="${INK}"/>`)
    out.push(`<text x="27" y="${top + 28}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="700" fill="${PAPER}">${esc(c.code)}</text>`)
    out.push(`<text x="54" y="${top + 22}" font-family="${FONT}" font-size="12" font-weight="700" fill="${INK}">${esc(title.length > 20 ? title.slice(0, 19) + '…' : title)}</text>`)
    out.push(`<text x="54" y="${top + 37}" font-family="${FONT}" font-size="10.5" font-weight="600" fill="${MUTED}">${esc(subText(n))}</text>`)
    for (const td of c.L.concat(c.R)) {
      const t = terminal(n, td[0])!
      const p = terminalLocal(n, td[0])!
      const conn = wires.some((w) => (w.a.n === n.id && w.a.t === td[0]) || (w.b.n === n.id && w.b.t === td[0]))
      const col = TERM[td[2]]
      out.push(`<rect x="${p.x - 6}" y="${p.y - 6}" width="12" height="12" fill="${conn ? col : NODE_BG}" stroke="${col}" stroke-width="2"/>`)
      const dom = DOMAIN_LABEL[td[2]].replace(/^DC [+−]$/, 'DC').replace(/^AC [LN]$/, 'AC').replace('Earth', 'PE')
      if (t.side === 'L' || t.side === 'R') {
        const left = t.side === 'L'
        out.push(
          `<text x="${left ? 12 : w - 12}" y="${p.y + 4}" text-anchor="${left ? 'start' : 'end'}" font-family="${FONT}" font-size="11" font-weight="600" fill="${INK}">${esc(td[1])} <tspan font-size="9" fill="${MUTED}">${dom}</tspan></text>`,
        )
      } else {
        // Rotated cards: label centred under (top edge) or above (bottom edge) the terminal.
        const label = td[1].length > 9 ? td[1].slice(0, 8) + '…' : td[1]
        out.push(
          `<text x="${p.x}" y="${t.side === 'T' ? p.y + 21 : p.y - 13}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="600" fill="${INK}">${esc(label)}</text>`,
        )
      }
    }
    out.push('</g>')
  }

  // Title block along the bottom.
  const ty = y0 + height - titleH
  const date = new Date().toISOString().slice(0, 10)
  out.push(`<line x1="${x0}" y1="${ty}" x2="${x0 + width}" y2="${ty}" stroke="${INK}" stroke-width="1"/>`)
  out.push(`<rect x="${x0 + 20}" y="${ty + 20}" width="12" height="12" fill="${PRIMARY}"/>`)
  out.push(`<text x="${x0 + 40}" y="${ty + 31}" font-family="${FONT}" font-size="14" font-weight="700" fill="${INK}">${esc(opts.projectName)}</text>`)
  out.push(
    `<text x="${x0 + 40}" y="${ty + 49}" font-family="${FONT}" font-size="10.5" fill="${MUTED}">SolarSketch wiring diagram · ${date} · Rules v${RULESET_VERSION} · Catalog ${CATALOG_VERSION} · Educational diagram, not for installation</text>`,
  )

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${width} ${height}">${out.join('')}</svg>`
  return { svg, width, height }
}

/** Rasterise the SVG at `scale` × size. */
export async function svgToPng(d: DiagramSvg, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([d.svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(d.width * scale)
    canvas.height = Math.round(d.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
