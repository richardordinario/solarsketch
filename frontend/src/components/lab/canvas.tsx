import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'

import { CATALOG, DOMAIN_LABEL, LOAD_TYPES, isBattery, isPv } from '@/engine/catalog'
import { nodeTitle } from '@/engine/profiles'
import { HEADER_BLOCK_H, VERTICAL_COL_W, headerTop, isVertical, nodeSize, rotationOf, subText, terminal, terminalLocal, terminalName, terminalPos, wireRoutes, type WireRoute } from '@/engine/geometry'
import { FAULT_DEFS, isActive } from '@/engine/faults'
import { wireFlows } from '@/engine/flows'
import { clockStr, compute, isDaylight, type Measurements } from '@/engine/simulation'
import type { ComponentType, LabNode, Severity, TermRef } from '@/engine/types'
import { checkWire, nodeMap, type NodeMap, type ValidationResult } from '@/engine/validation'
import { cn } from '@/lib/utils'
import { useLabStore, useValidation, type Tool } from '@/store/lab-store'

import { TERMINAL_COLOR, WIRE_COLOR } from './colors'
import { DRAG_MIME, parseDragPayload } from './library-panel'
import { useWireVisibility } from '@/hooks/use-wire-visibility'
import { WireFilterNotice } from './wire-filter-notice'
import { SEV_COLOR, SEV_LABEL } from './severity'
import { SevIcon } from './sev-icon'
import { t } from '@/i18n'

const SEV_RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 }

/** Compact domain tag next to each terminal label. */
function shortDomain(label: string) {
  return label.replace(/^DC [+−]$/, 'DC').replace(/^AC [LN]$/, 'AC').replace('Earth', 'PE')
}

interface TerminalView {
  key: string
  id: string
  label: string
  dom: string
  sqLeft: number
  sqTop: number
  lblLeft: number
  lblTop: number
  lblWidth: number
  /** Rotated cards show the label only (the domain is in the tooltip). */
  compact: boolean
  align: 'left' | 'right' | 'center'
  sqBg: string
  sqBorder: string
  ring: string
  op: number
  title: string
}

interface NodeViewProps {
  node: LabNode
  selected: boolean
  tool: Tool
  sub: string
  subColor: string
  sev?: Severity
  terms: TerminalView[]
  /** A visible (non-hidden) injected fault is active on this component. */
  faulted?: string
}

function NodeView({ node, selected, tool, sub, subColor, sev, terms, faulted }: NodeViewProps) {
  const c = CATALOG[node.type]
  const border = selected ? 'var(--primary)' : 'var(--node-border)'
  const nodeDown = useLabStore((s) => s.nodeDown)
  const termDown = useLabStore((s) => s.termDown)
  const termUp = useLabStore((s) => s.termUp)
  const size = nodeSize(node)
  const vertical = isVertical(node)
  const rot = rotationOf(node)

  // Enter / Space select the focused component (Shift adds or removes it).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    const st = useLabStore.getState()
    const ids = st.sel.nodes
    st.select({ nodes: e.shiftKey ? (ids.includes(node.id) ? ids.filter((x) => x !== node.id) : ids.concat([node.id])) : [node.id], wire: null })
  }

  return (
    <div
      data-node-id={node.id}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-roledescription={t('component')}
      aria-label={`${nodeTitle(node)}, ${sub}${rot ? `, ${t('rotated {deg}°', { deg: rot })}` : ''}${sev && sev !== 'info' ? `, ${t(SEV_LABEL[sev])}` : ''}`}
      aria-describedby="canvas-keyboard-help"
      onMouseDown={(e) => nodeDown(node.id, e)}
      onKeyDown={onKeyDown}
      className="absolute bg-node outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      style={{
        left: node.x,
        top: node.y,
        width: size.w,
        height: size.h,
        border: `2px solid ${border}`,
        boxShadow: selected ? '0 0 0 2px var(--primary), 0 3px 10px var(--node-shadow)' : 'none',
        cursor: tool === 'pan' ? 'grab' : tool === 'wire' ? 'default' : 'move',
      }}
    >
      <div
        className="absolute inset-x-0 flex items-center gap-2 px-2"
        style={{ top: headerTop(node) - (vertical ? 2 : 0), height: HEADER_BLOCK_H, borderBottom: `2px solid ${border}`, borderTop: vertical ? `2px solid ${border}` : undefined }}
      >
        <div
          className="flex h-[30px] w-[38px] flex-none items-center justify-center text-[10px] font-strong tracking-[.04em] text-(--node-code-fg)"
          style={{ background: selected ? 'var(--primary)' : 'var(--secondary)' }}
        >
          {c.code}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-strong" title={nodeTitle(node)}>
            {nodeTitle(node, true)}
          </div>
          <div className="truncate text-[11px] font-semibold tabular-nums" style={{ color: subColor }}>
            {sub}
          </div>
        </div>
        {faulted && (
          <div title={`${t('Fault')}: ${t(faulted)}`} aria-label={`${t('Fault')}: ${t(faulted)}`} className="text-[11px] font-strong text-critical">
            ⚡
          </div>
        )}
        {sev && sev !== 'info' && (
          <div title={`${SEV_LABEL[sev]} finding`} className="flex items-center" style={{ color: SEV_COLOR[sev] }}>
            <SevIcon sev={sev} />
          </div>
        )}
      </div>
      {terms.map((t) => (
        <div key={t.key}>
          <div
            onMouseDown={(e) => termDown(node.id, t.id, e)}
            onMouseUp={(e) => termUp(node.id, t.id, e)}
            title={t.title}
            className="absolute z-[2] size-3 cursor-crosshair"
            style={{ left: t.sqLeft, top: t.sqTop, background: t.sqBg, border: `2px solid ${t.sqBorder}`, boxShadow: t.ring, opacity: t.op }}
          />
          <div
            className={cn('pointer-events-none absolute font-semibold whitespace-nowrap', t.compact ? 'truncate text-[10px]' : 'text-[11px]')}
            style={{ left: t.lblLeft, top: t.lblTop, width: t.lblWidth, textAlign: t.align, opacity: t.op }}
          >
            {t.label} {!t.compact && <span className="text-[9px] font-semibold text-subtle">{t.dom}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Current drawn by the running loads plugged into an outlet, A. */
const outletAmps = (n: LabNode, m: Measurements, outletsOf: Record<string, string[]>) => m.onLoads.filter((l) => outletsOf[l.id]?.includes(n.id)).reduce((a, l) => a + l.specs.p, 0) / 230

function liveSub(n: LabNode, m: Measurements, soc: number, rcdTripped: string[], outletsOf: Record<string, string[]>): { sub: string; color: string } | null {
  const factor = m.moduleFactor[n.id]
  const live: Partial<Record<ComponentType, string>> = {
    pv: factor !== undefined && m.ppv > 0 ? t('{w} W out', { w: (m.modulePower[n.id] ?? 0).toFixed(0) }) : t('Not generating'),
    mppt: m.bmsOff ? t('No battery (BMS cut-off)') : t('{w} W to battery', { w: m.cc.toFixed(0) }),
    bat: m.bmsOff ? t('BMS CUT-OFF') : m.ac.bmsOvercurrent ? t('BMS OVER-CURRENT') : `SOC ${soc.toFixed(0)}% · ${m.pbat >= 0 ? '+' : ''}${m.pbat.toFixed(0)} W`,
    inv: m.dcOff ? t('OFF · no DC input') : m.thermalTrip ? t('OFF · thermal trip') : m.invOn ? `${t('ON')} · ${m.pload.toFixed(0)} W · ${m.freq} Hz${m.derated ? ` · ${t('DERATED')}` : ''}${m.ac.invStrained ? ` · ${t('OVERLOADED')}` : ''}` : t('OFF'),
    acdb: rcdTripped.includes(n.id) ? t('RCD TRIPPED') : undefined,
    outlet: m.ac.outletsLive.includes(n.id) ? `${t('Live')} · ${outletAmps(n, m, outletsOf).toFixed(1)} A` : undefined,
    gti: m.ac.gtiIslanded ? t('OFF · no grid') : m.ac.gtiAc > 1 ? t('{w} W to AC', { w: m.ac.gtiAc.toFixed(0) }) : t('Idle'),
    hyb: t({ off: 'OFF', none: 'OFF', grid: 'Grid', battery: 'Battery', generator: 'Generator' }[m.ac.hybMode]) + ` · ${m.ac.hybBattery >= 0 ? '+' : ''}${m.ac.hybBattery.toFixed(0)} W ${t('batt')}`,
    grid: m.ac.gridOut.includes(n.id) ? t('OUTAGE') : m.ac.pgrid > 1 ? t('Importing {w} W', { w: m.ac.pgrid.toFixed(0) }) : m.ac.pgrid < -1 ? t('Exporting {w} W', { w: (-m.ac.pgrid).toFixed(0) }) : t('Connected'),
    nm: m.ac.pgrid > 1 ? `→ ${m.ac.pgrid.toFixed(0)} W in` : m.ac.pgrid < -1 ? `← ${(-m.ac.pgrid).toFixed(0)} W out` : '0 W',
    gen: m.ac.genOverload ? t('OVERLOAD') : m.ac.pgen > 0 ? `${t('ON')} · ${m.ac.pgen.toFixed(0)} W` : t('Standby'),
    ats: t(m.ac.atsSide[n.id] === 'main' ? 'On main' : m.ac.atsSide[n.id] === 'backup' ? 'On backup' : 'No source'),
    // Inline devices: open switches, tripped RCCBs and live meter readings.
    rccb: rcdTripped.includes(n.id) ? t('RCD TRIPPED') : undefined,
    dcm: m.meters[n.id] ? `${m.meters[n.id].v.toFixed(1)} V · ${m.meters[n.id].a.toFixed(1)} A · ${m.meters[n.id].w.toFixed(0)} W` : undefined,
    acm: m.meters[n.id] ? `${m.meters[n.id].v.toFixed(0)} V · ${m.meters[n.id].a.toFixed(2)} A · ${m.meters[n.id].w.toFixed(0)} W` : undefined,
  }
  if (n.specs.closed === 0) return { sub: t('OPEN · switched off'), color: 'var(--critical)' }
  const lv = live[isPv(n) ? 'pv' : isBattery(n) ? 'bat' : n.type]
  if (lv) return { sub: lv, color: 'var(--critical)' }
  if (LOAD_TYPES.includes(n.type)) {
    const on = m.onLoads.some((l) => l.id === n.id)
    const rcd = m.rcdOff.some((l) => l.id === n.id)
    const shed = m.ac.shed.some((x) => x.id === n.id)
    const surge = m.ac.blocked.some((l) => l.id === n.id)
    const sub = on ? `${t('ON')} · ${n.specs.p} W` : rcd ? t('OFF · RCD tripped') : shed ? t('OFF · load shed') : surge ? t('OFF · surge overload') : t('OFF')
    return { sub, color: on || rcd || shed || surge ? 'var(--critical)' : 'var(--muted-foreground)' }
  }
  return null
}

function buildTerminals(n: LabNode, nm: NodeMap, connected: Set<string>, pending: TermRef | null): TerminalView[] {
  const c = CATALOG[n.type]
  const { w, h } = nodeSize(n)
  return c.L.concat(c.R).map((td) => {
    const t = terminal(n, td[0])!
    const p = terminalLocal(n, td[0])!
    const key = n.id + ':' + td[0]
    const conn = connected.has(key)
    let ring = 'none'
    let op = 1
    if (pending && pending.n === n.id && pending.t === td[0]) ring = '0 0 0 3px var(--primary)'
    else if (pending) {
      const r = checkWire({ id: '_', a: pending, b: { n: n.id, t: td[0] }, color: 'auto', gauge: '50' }, nm)
      if (r && !r.fail) ring = '0 0 0 2px var(--primary-soft)'
      else op = 0.3
    }
    // Positions are inside the 2px card border; the square is 12px and centred on the connection point.
    const geo =
      t.side === 'L' || t.side === 'R'
        ? {
            sqLeft: t.side === 'L' ? -7 : w - 9,
            sqTop: p.y - 8,
            lblLeft: t.side === 'L' ? 12 : w - 12 - 76 - 4,
            lblTop: p.y - 9,
            lblWidth: 76,
            compact: false,
            align: t.side === 'L' ? ('left' as const) : ('right' as const),
          }
        : {
            sqLeft: p.x - 8,
            sqTop: t.side === 'T' ? -7 : h - 9,
            lblLeft: p.x - 2 - (VERTICAL_COL_W - 4) / 2,
            lblTop: t.side === 'T' ? 8 : h - 28,
            lblWidth: VERTICAL_COL_W - 4,
            compact: true,
            align: 'center' as const,
          }
    return {
      key,
      id: td[0],
      label: td[1],
      dom: shortDomain(DOMAIN_LABEL[td[2]]),
      ...geo,
      sqBg: conn ? TERMINAL_COLOR[td[2]] : 'var(--term-empty)',
      sqBorder: TERMINAL_COLOR[td[2]],
      ring,
      op,
      title: `${td[1]} · ${DOMAIN_LABEL[td[2]]}${conn ? '' : ' · not connected'}`,
    }
  })
}

/** Keyboard wiring: a list of the focused component's terminals. Arrow keys move, Enter picks, Esc closes. */
function TerminalPicker({ nm }: { nm: NodeMap }) {
  const nodeId = useLabStore((s) => s.termPicker)
  const pending = useLabStore((s) => s.pending)
  const wires = useLabStore((s) => s.wires)
  const ref = useRef<HTMLDivElement>(null)
  const node = nodeId ? nm[nodeId] : undefined

  useEffect(() => {
    if (!node) return
    const first = ref.current?.querySelector<HTMLButtonElement>('button:not([disabled])')
    first?.focus()
  }, [node])

  if (!node) return null
  const c = CATALOG[node.type]
  const refocusNode = () => document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`)?.focus()
  const close = () => {
    useLabStore.getState().openTermPicker(null)
    refocusNode()
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') return
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]?.focus()
  }
  const { w } = nodeSize(node)
  const title = pending ? t('Connect {from} to…', { from: terminalName(nm[pending.n] ?? node, pending.t) }) : t('Wire from which terminal?')

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
      className="absolute z-[5] min-w-[180px] edge bg-background p-1 text-xs shadow-[0_3px_10px_var(--node-shadow)]"
      style={{ left: node.x + w + 12, top: node.y }}
    >
      <div className="px-2 pt-1 pb-1.5 text-[11px] font-strong">{title}</div>
      <div role="group">
        {c.L.concat(c.R).map((td) => {
          const self = pending?.n === node.id && pending.t === td[0]
          const ok = !pending || self || (() => {
            const r = checkWire({ id: '_', a: pending, b: { n: node.id, t: td[0] }, color: 'auto', gauge: '50' }, nm)
            return !!r && !r.fail
          })()
          const conn = wires.some((x) => (x.a.n === node.id && x.a.t === td[0]) || (x.b.n === node.id && x.b.t === td[0]))
          return (
            <button
              key={td[0]}
              type="button"
              disabled={pending ? pending.n === node.id && !self : false}
              onClick={() => {
                useLabStore.getState().pickTerminal(node.id, td[0])
                refocusNode()
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-1 text-left font-semibold outline-none hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-40',
                !ok && 'text-muted-foreground',
              )}
            >
              <span aria-hidden className="size-2.5 flex-none" style={{ background: TERMINAL_COLOR[td[2]] }} />
              <span className="flex-1">{td[1]}</span>
              <span className="text-[10px] text-subtle">
                {DOMAIN_LABEL[td[2]]}
                {self ? ` · ${t('cancel')}` : pending && !ok ? ` · ${t('not compatible')}` : conn ? ` · ${t('connected')}` : ''}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Box-select rectangle (world coordinates). */
function MarqueeLayer() {
  const m = useLabStore((s) => s.marquee)
  if (!m) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-[4] border border-dashed border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)]"
      style={{ left: m.x0, top: m.y0, width: m.x1 - m.x0, height: m.y1 - m.y0 }}
    />
  )
}

function WireLayer({ v, nm, routes }: { v: ValidationResult; nm: NodeMap; routes: Record<string, WireRoute> }) {
  const wires = useLabStore((s) => s.wires)
  const selWire = useLabStore((s) => s.sel.wire)
  const pending = useLabStore((s) => s.pending)
  const mouse = useLabStore((s) => (s.pending ? s.mouse : null))
  const tool = useLabStore((s) => s.tool)
  const { select, wireDown, updateWire } = useLabStore.getState()
  const vis = useWireVisibility(v, nm)

  const paths: React.ReactNode[] = []
  const badges: React.ReactNode[] = []
  wires.forEach((w) => {
    const na = nm[w.a.n]
    const nb = nm[w.b.n]
    const r = routes[w.id]
    if (!na || !nb || !r || vis[w.id] === 'hide') return
    const d = r.d
    if (vis[w.id] === 'dim') {
      // Faded context wire: visible for orientation, not clickable.
      paths.push(<path key={w.id} d={d} fill="none" style={{ stroke: 'var(--dim)', opacity: 0.25, pointerEvents: 'none' }} strokeWidth={1.5} strokeLinejoin="round" />)
      return
    }
    const ta = terminal(na, w.a.t)!.t
    const tb = terminal(nb, w.b.t)!.t
    const ty = ta === 'dc' ? tb : ta
    const col = w.color === 'auto' ? (ty === 'pe' ? 'gy' : TERMINAL_COLOR[ty === 'dc' ? 'dc+' : ty]) : WIRE_COLOR[w.color]
    const fail = v.wres[w.id]?.fail
    const sel = selWire === w.id
    const sw = 1.5 + Math.min(3, parseFloat(w.gauge) / 14)
    const pick = (e: React.MouseEvent) => {
      e.stopPropagation()
      select({ nodes: [], wire: w.id })
    }
    // Press and drag a wire to move its middle segment apart from others.
    const grab = (e: React.MouseEvent) => wireDown(w.id, r.axis, r.bend, e)
    const moveCursor = tool === 'select' ? (r.axis === 'x' ? 'ew-resize' : 'ns-resize') : 'pointer'
    if (sel) paths.push(<path key={w.id + 's'} d={d} fill="none" style={{ stroke: 'var(--primary-soft)' }} strokeWidth={sw + 6} strokeLinejoin="round" />)
    paths.push(<path key={w.id} d={d} fill="none" style={{ stroke: col === 'gy' ? 'var(--term-pe)' : col }} strokeWidth={sw} strokeLinejoin="round" strokeDasharray={fail ? '7 5' : undefined} />)
    if (col === 'gy') paths.push(<path key={w.id + 'y'} d={d} fill="none" style={{ stroke: 'var(--term-pe-stripe)' }} strokeWidth={sw} strokeDasharray="6 6" strokeLinejoin="round" />)
    paths.push(<path key={w.id + 'h'} d={d} fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: sel ? moveCursor : 'pointer', pointerEvents: 'stroke' }} onMouseDown={grab} />)
    if (sel && tool === 'select') {
      // Drag handle on the middle segment; double-click returns the wire to the automatic route.
      paths.push(
        <rect
          key={w.id + 'g'}
          x={r.handle.x - 5}
          y={r.handle.y - 5}
          width={10}
          height={10}
          style={{ fill: 'var(--background)', stroke: 'var(--primary)', cursor: moveCursor, pointerEvents: 'all' }}
          strokeWidth={2}
          onMouseDown={grab}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (w.bend !== undefined) updateWire(w.id, { bend: undefined })
          }}
        >
          <title>{t('Drag to move this wire. Double-click to reset its route.')}</title>
        </rect>,
      )
    }
    if (fail) {
      const p = r.mid
      const crit = fail.sev === 'critical'
      badges.push(
        <div
          key={w.id + 'b'}
          onMouseDown={pick}
          title={`${fail.rule}: ${fail.msg}`}
          className="absolute z-[3] -mt-2.5 -ml-2.5 flex size-5 cursor-pointer items-center justify-center edge text-[10px] font-strong"
          style={{ left: p.x, top: p.y, background: crit ? 'var(--primary)' : 'var(--badge-warn-bg)', color: crit ? '#fff' : 'var(--badge-warn-fg)' }}
        >
          <SevIcon sev={fail.sev} className="size-3" />
        </div>,
      )
    }
  })
  if (pending && mouse && nm[pending.n]) {
    const a = terminalPos(nm[pending.n], pending.t)
    paths.push(<path key="pend" d={`M${a.x},${a.y} L${mouse.x},${mouse.y}`} strokeWidth={2} strokeDasharray="4 4" fill="none" style={{ stroke: 'var(--primary)', pointerEvents: 'none' }} />)
  }

  return (
    <>
      <svg width={1} height={1} className="absolute top-0 left-0 overflow-visible">
        {paths}
      </svg>
      {badges}
    </>
  )
}

/** Moving dots along wires that carry current (direction and speed from engine/flows.ts). */
function FlowLayer({ v, nm, routes }: { v: ValidationResult; nm: NodeMap; routes: Record<string, WireRoute> }) {
  const show = useLabStore((s) => s.settings.showFlow)
  const started = useLabStore((s) => s.sim.started)
  const running = useLabStore((s) => s.running)
  const sim = useLabStore((s) => s.sim)
  const clear = useLabStore((s) => s.clear)
  const faults = useLabStore((s) => s.faults)
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  const vis = useWireVisibility(v, nm)
  if (!show || !started) return null
  const flows = wireFlows(nodes, wires, v, compute(sim, v, clear, faults), sim.t, faults)
  return (
    <svg width={1} height={1} className="pointer-events-none absolute top-0 left-0 overflow-visible" aria-hidden>
      {wires.map((w) => {
        const f = flows[w.id]
        const na = nm[w.a.n]
        const nb = nm[w.b.n]
        if (!f || !na || !nb || !routes[w.id] || vis[w.id] !== 'show') return null
        const d = routes[w.id].d
        // Speed grows with current, on a log scale so 0.3 A and 60 A both read well.
        const dur = Math.max(0.35, 2.2 / (1 + Math.log2(1 + f.amps)))
        return (
          <path
            key={w.id}
            d={d}
            fill="none"
            className="flow-dots"
            strokeWidth={3 + Math.min(3, parseFloat(w.gauge) / 14)}
            strokeLinecap="round"
            strokeDasharray="0.1 14"
            style={{ animationDuration: `${dur}s`, animationDirection: f.dir === 1 ? 'normal' : 'reverse', animationPlayState: running ? 'running' : 'paused' }}
          >
            <title>{`${f.amps.toFixed(2)} A`}</title>
          </path>
        )
      })}
    </svg>
  )
}

function Nodes({ v, nm }: { v: ValidationResult; nm: NodeMap }) {
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  const selNodes = useLabStore((s) => s.sel.nodes)
  const tool = useLabStore((s) => s.tool)
  const pending = useLabStore((s) => s.pending)
  const sim = useLabStore((s) => s.sim)
  const clear = useLabStore((s) => s.clear)

  const faults = useLabStore((s) => s.faults)
  const m = sim.started ? compute(sim, v, clear, faults) : null
  const nodeSev: Record<string, Severity> = {}
  v.issues.forEach((i) => {
    const id = i.target.node
    if (id && (!nodeSev[id] || SEV_RANK[i.sev] > SEV_RANK[nodeSev[id]])) nodeSev[id] = i.sev
  })
  const connected = new Set<string>()
  wires.forEach((w) => {
    connected.add(w.a.n + ':' + w.a.t)
    connected.add(w.b.n + ':' + w.b.t)
  })

  return nodes.map((n) => {
    const live = m ? liveSub(n, m, sim.soc, sim.rcdTripped ?? [], v.sys.outletsOf) : null
    const visibleFault = faults.find((f) => !f.hidden && f.target === n.id && isActive(f, sim.t))
    return (
      <NodeView
        key={n.id}
        node={n}
        selected={selNodes.includes(n.id)}
        tool={tool}
        sub={live ? live.sub : subText(n)}
        subColor={live ? live.color : 'var(--muted-foreground)'}
        sev={nodeSev[n.id]}
        faulted={visibleFault ? FAULT_DEFS[visibleFault.kind].label : undefined}
        terms={buildTerminals(n, nm, connected, pending)}
      />
    )
  })
}

/** Canvas keyboard and mouse shortcuts, shown in the legend. */
const SHORTCUTS: [string, string][] = [
  ['Tab', 'Focus the next component'],
  ['Enter / Space', 'Select the focused component'],
  ['Arrows', 'Move selected (Shift: larger steps)'],
  ['R', 'Rotate selected 90°'],
  ['W', 'Wire: pick terminals of the focused component'],
  ['Esc', 'Cancel wiring or clear selection'],
  ['Drag', 'Box select (Shift adds)'],
  ['Space + drag', 'Pan the sheet'],
  ['Del', 'Delete selected'],
  ['Drag a selected wire', 'Move its middle segment (double-click the handle to reset)'],
  ['X', 'Hide or show all wires'],
]

function Legend() {
  const open = useLabStore((s) => s.legendOpen)
  const toggle = useLabStore((s) => s.toggleLegend)
  const swatch = 'h-[3px] w-4'
  return (
    <div onMouseDown={(e) => e.stopPropagation()} className="absolute right-2 bottom-2 edge bg-background text-[10px] font-semibold">
      <button onClick={toggle} className="block w-full cursor-pointer border-0 bg-transparent px-2 py-[3px] text-left text-[10px] font-strong tracking-[.06em] hover:bg-muted">
        {t('LEGEND')} {open ? '−' : '+'}
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 px-2 pt-0.5 pb-1.5">
          <div className="flex items-center gap-1.5"><span className={swatch} style={{ background: 'var(--term-dc-pos)' }} />DC+</div>
          <div className="flex items-center gap-1.5"><span className={swatch} style={{ background: 'var(--term-dc-neg)' }} />DC−</div>
          <div className="flex items-center gap-1.5"><span className={swatch} style={{ background: 'var(--term-ac-l)' }} />AC L</div>
          <div className="flex items-center gap-1.5"><span className={swatch} style={{ background: 'var(--term-ac-n)' }} />AC N</div>
          <div className="flex items-center gap-1.5"><span className={swatch} style={{ background: 'repeating-linear-gradient(90deg,var(--term-pe) 0 4px,var(--term-pe-stripe) 4px 8px)' }} />PE</div>
          <div className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-[3px] border-dashed border-dim" />Fault</div>
          <div className="mt-1 border-t border-rule pt-1 font-strong tracking-[.06em]">{t('KEYS')}</div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-normal">
            {SHORTCUTS.map(([k, d]) => (
              <Fragment key={k}>
                <dt className="font-semibold whitespace-nowrap">{t(k)}</dt>
                <dd className="m-0">{t(d)}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

/** System voltages for the sheet tag, taken from the inverter (or controller) on the canvas. */
function SheetLabel({ nodes }: { nodes: LabNode[] }) {
  const inv = nodes.find((n) => n.type === 'inv' || n.type === 'hyb')
  const cc = nodes.find((n) => n.type === 'mppt' || n.type === 'pwm')
  const hasGrid = nodes.some((n) => n.type === 'grid')
  const rawKind = nodes.some((n) => n.type === 'hyb') ? 'Hybrid' : hasGrid ? 'Grid-tied' : 'Off-grid'
  const kind = t(rawKind)
  const dcV = (inv ?? cc)?.specs.nomV
  const acV = (inv ?? nodes.find((n) => n.type === 'gti' || n.type === 'grid'))?.specs.acV
  const dc = dcV != null ? `${dcV} V DC` : rawKind === 'Grid-tied' ? t('No battery') : '— V DC'
  const ac = acV != null ? `${acV} V AC` : '— V AC'
  return (
    <div title={`${kind} system · ${dc} · ${ac}${acV != null ? ' 60 Hz' : ''}`} className="absolute top-2 left-2 flex max-w-[calc(100%-16px)] overflow-hidden edge bg-background whitespace-nowrap">
      <div className="edge-r px-2 py-1 text-[11px] font-strong">{t('SHEET 1')}</div>
      <div className="truncate px-2 py-1 text-[11px] font-semibold">
        {kind} · {dc} · {ac}
      </div>
    </div>
  )
}

/** Time-of-day badge, plus a faint night tint over the sheet while the simulation is in use. */
function SkyIndicator() {
  const time = useLabStore((s) => s.sim.t)
  const started = useLabStore((s) => s.sim.started)
  const clear = useLabStore((s) => s.clear)
  const day = isDaylight(time)
  const h = (time / 60) % 24
  const G = h > 6 && h < 18 ? (1000 * Math.sin((Math.PI * (h - 6)) / 12) * clear) / 100 : 0
  return (
    <>
      {started && !day && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[rgba(20,40,110,0.08)]" />}
      <div className="absolute top-2 right-2 flex items-center gap-2 edge bg-background px-2 py-1 text-[11px] font-semibold tabular-nums" title={t(day ? 'Daytime: PV can generate' : 'Night: loads run from the battery')}>
        <span aria-hidden style={{ color: day ? 'var(--term-pe-stripe)' : 'var(--term-ac-n)' }}>{day ? '☀' : '☾'}</span>
        <span>{clockStr(time)}</span>
        <span className="text-muted-foreground">{G.toFixed(0)} W/m²</span>
        <FlowToggle />
      </div>
    </>
  )
}

function FlowToggle() {
  const on = useLabStore((s) => s.settings.showFlow)
  const setSettings = useLabStore((s) => s.setSettings)
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setSettings({ showFlow: !on })}
      title={t('Current flow animation')}
      className={cn('-my-1 -mr-2 ml-1 cursor-pointer border-0 border-l border-rule px-2 py-1 text-[11px] font-semibold', on ? 'bg-secondary text-secondary-foreground' : 'bg-transparent text-dim hover:bg-muted')}
    >
      ⚡ {t('Flow')}
    </button>
  )
}

function PendingHint() {
  const pending = useLabStore((s) => s.pending)
  const nodes = useLabStore((s) => s.nodes)
  const node = pending && nodes.find((n) => n.id === pending.n)
  if (!pending || !node) return null
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 bg-secondary px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-secondary-foreground">
      {t('Wiring from {from}. Click a highlighted terminal (or focus a component and press W), or press Esc to cancel.', { from: terminalName(node, pending.t) })}
    </div>
  )
}

export function Canvas() {
  const ref = useRef<HTMLDivElement>(null)
  const view = useLabStore((s) => s.view)
  const tool = useLabStore((s) => s.tool)
  const hasPending = useLabStore((s) => !!s.pending)
  const empty = useLabStore((s) => s.nodes.length === 0)
  const showGrid = useLabStore((s) => s.settings.showGrid)
  const nodes = useLabStore((s) => s.nodes)
  const { setViewportEl, viewportDown, dropAt, zoomAt, fit } = useLabStore.getState()
  const wires = useLabStore((s) => s.wires)
  const wireStyle = useLabStore((s) => s.settings.wireStyle)
  const v = useValidation()
  const nm = nodeMap(nodes)
  // One routing pass shared by the wires and the flow dots (automatic lanes keep parallel runs apart).
  const routes = useMemo(() => wireRoutes(wires, nodeMap(nodes), wireStyle), [wires, nodes, wireStyle])

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)
    },
    [zoomAt],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setViewportEl(el)
    el.addEventListener('wheel', onWheel, { passive: false })
    const t = setTimeout(fit, 60)
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(t)
      setViewportEl(null)
    }
  }, [setViewportEl, onWheel, fit])

  const z = view.z
  return (
    <div
      ref={ref}
      data-canvas="viewport"
      role="region"
      aria-label={t('Wiring sheet')}
      onMouseDown={viewportDown}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        const d = parseDragPayload(e.dataTransfer.getData(DRAG_MIME))
        if (d) dropAt(d.type, e.clientX, e.clientY, d.profileId)
      }}
      className="relative overflow-hidden bg-canvas"
      style={{
        cursor: tool === 'pan' ? 'grab' : hasPending ? 'crosshair' : 'default',
        backgroundImage: showGrid
          ? 'linear-gradient(var(--grid-major) 1px, transparent 1px), linear-gradient(90deg, var(--grid-major) 1px, transparent 1px), linear-gradient(var(--grid-minor) 1px, transparent 1px), linear-gradient(90deg, var(--grid-minor) 1px, transparent 1px)'
          : 'none',
        backgroundSize: `${100 * z}px ${100 * z}px, ${100 * z}px ${100 * z}px, ${20 * z}px ${20 * z}px, ${20 * z}px ${20 * z}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${z})` }}>
        <WireLayer v={v} nm={nm} routes={routes} />
        <FlowLayer v={v} nm={nm} routes={routes} />
        <Nodes v={v} nm={nm} />
        <MarqueeLayer />
        <TerminalPicker nm={nm} />
      </div>
      <p id="canvas-keyboard-help" className="sr-only">
        {t('Arrow keys move the selected components. R rotates. W lists this component’s terminals for wiring. Escape cancels.')}
      </p>

      <SheetLabel nodes={nodes} />
      <SkyIndicator />
      <PendingHint />
      <WireFilterNotice v={v} nm={nm} />
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[340px] border-2 border-dashed border-subtle px-6 py-5 text-muted-foreground">
            <div className="mb-1 font-strong text-foreground">{t('Empty sheet')}</div>
            {t('Drag components from the library to start building a system.')}
          </div>
        </div>
      )}
      <Legend />
    </div>
  )
}
