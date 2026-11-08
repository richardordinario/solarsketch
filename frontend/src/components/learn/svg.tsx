/**
 * Small SVG toolkit for lesson illustrations and walkthroughs. Colours come from the theme's CSS
 * variables (through `style`, never attributes), so every drawing follows light and dark mode.
 * Conductor colours are visual conventions only; labels carry the meaning too.
 */
import type { CSSProperties, ReactNode } from 'react'

import { C } from './svg-colors'


/** Responsive SVG canvas. `label` is the accessible description (the figure caption repeats it visibly). */
export function Svg({ viewBox, label, children, className }: { viewBox: string; label: string; children: ReactNode; className?: string }) {
  return (
    <svg viewBox={viewBox} role="img" aria-label={label} className={className ?? 'block h-auto w-full'} style={{ fontFamily: 'inherit', maxHeight: 360 }}>
      {children}
    </svg>
  )
}

export function T({
  x,
  y,
  children,
  size = 12,
  anchor = 'middle',
  color = C.fg,
  weight = 400,
  style,
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  anchor?: 'start' | 'middle' | 'end'
  color?: string
  weight?: number
  style?: CSSProperties
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={size} fontWeight={weight} style={{ fill: color, ...style }}>
      {children}
    </text>
  )
}

/** Component block: a box with a code and an optional second line. */
export function Block({
  x,
  y,
  w = 96,
  h = 48,
  label,
  sub,
  accent,
  dim,
  style,
}: {
  x: number
  y: number
  w?: number
  h?: number
  label: string
  sub?: string
  accent?: string
  dim?: boolean
  style?: CSSProperties
}) {
  return (
    <g style={{ opacity: dim ? 0.35 : 1, transition: 'opacity .4s', ...style }}>
      <rect x={x} y={y} width={w} height={h} strokeWidth={1.5} style={{ fill: C.node, stroke: accent ?? C.nodeBorder }} />
      {accent && <rect x={x} y={y} width={4} height={h} style={{ fill: accent }} />}
      <T x={x + w / 2} y={sub ? y + h / 2 - 8 : y + h / 2} weight={700} size={12}>
        {label}
      </T>
      {sub && (
        <T x={x + w / 2} y={y + h / 2 + 9} size={10} color={C.muted}>
          {sub}
        </T>
      )}
    </g>
  )
}

/** A conductor along a list of points. */
export function Line({
  pts,
  color = C.fg,
  width = 2,
  dash,
  marker,
  style,
}: {
  pts: [number, number][]
  color?: string
  width?: number
  dash?: string
  marker?: string
  style?: CSSProperties
}) {
  return (
    <polyline
      points={pts.map((p) => p.join(',')).join(' ')}
      fill="none"
      strokeWidth={width}
      strokeDasharray={dash}
      strokeLinejoin="round"
      markerEnd={marker}
      style={{ stroke: color, ...style }}
    />
  )
}

/** Animated current-flow dots along a path (the canvas's .flow-dots style; static under reduced motion). */
export function Flow({ pts, reverse, paused }: { pts: [number, number][]; reverse?: boolean; paused?: boolean }) {
  return (
    <polyline
      points={pts.map((p) => p.join(',')).join(' ')}
      fill="none"
      className="flow-dots"
      strokeWidth={3}
      strokeLinecap="round"
      strokeDasharray="0.1 14"
      style={{ animationDuration: '0.9s', animationDirection: reverse ? 'reverse' : 'normal', animationPlayState: paused ? 'paused' : 'running' }}
    />
  )
}

/** Protective-earth conductor: green with a yellow dashed stripe, so it is not identified by colour alone. */
export function PeLine({ pts }: { pts: [number, number][] }) {
  return (
    <g>
      <Line pts={pts} color={C.pe} width={3} />
      <Line pts={pts} color={C.peStripe} width={3} dash="5 5" />
    </g>
  )
}

/** Earth symbol (three bars) with its top at (x, y). */
export function Earth({ x, y }: { x: number; y: number }) {
  return (
    <g style={{ stroke: C.pe }} strokeWidth={2}>
      <line x1={x - 12} y1={y} x2={x + 12} y2={y} />
      <line x1={x - 8} y1={y + 5} x2={x + 8} y2={y + 5} />
      <line x1={x - 4} y1={y + 10} x2={x + 4} y2={y + 10} />
    </g>
  )
}

/** A PV module drawn as a cell grid. */
export function Module({ x, y, w = 60, h = 84, cols = 3, rows = 5, shade }: { x: number; y: number; w?: number; h?: number; cols?: number; rows?: number; shade?: number }) {
  const cw = w / cols
  const ch = h / rows
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} strokeWidth={1.5} style={{ fill: C.field, stroke: C.fg }} />
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols
        const r = Math.floor(i / cols)
        return (
          <rect
            key={i}
            x={x + c * cw + 2}
            y={y + r * ch + 2}
            width={cw - 4}
            height={ch - 4}
            style={{ fill: shade === c ? C.subtle : C.dc, opacity: shade === c ? 0.9 : 0.35 }}
          />
        )
      })}
    </g>
  )
}

/** Small "+" / "−" terminal marker. */
export function Pole({ x, y, sign }: { x: number; y: number; sign: '+' | '−' }) {
  return (
    <g>
      <circle cx={x} cy={y} r={6} strokeWidth={2} style={{ fill: C.card, stroke: sign === '+' ? C.pos : C.neg }} />
      <T x={x} y={y + 0.5} size={10} weight={700}>
        {sign}
      </T>
    </g>
  )
}

/** Battery drawn as a block with + and − posts. */
export function Battery({ x, y, label, sub, w = 70, h = 44 }: { x: number; y: number; label: string; sub?: string; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} strokeWidth={1.5} style={{ fill: C.node, stroke: C.fg }} />
      <rect x={x + 10} y={y - 6} width={12} height={6} style={{ fill: C.pos }} />
      <rect x={x + w - 22} y={y - 6} width={12} height={6} style={{ fill: C.neg }} />
      <T x={x + 16} y={y + 9} size={10} weight={700}>
        +
      </T>
      <T x={x + w - 16} y={y + 9} size={10} weight={700}>
        −
      </T>
      <T x={x + w / 2} y={y + (sub ? h / 2 + 2 : h / 2 + 4)} size={11} weight={700}>
        {label}
      </T>
      {sub && (
        <T x={x + w / 2} y={y + h / 2 + 14} size={9} color={C.muted}>
          {sub}
        </T>
      )}
    </g>
  )
}

/** Sun glyph. */
export function Sun({ x, y, r = 12 }: { x: number; y: number; r?: number }) {
  return (
    <g style={{ stroke: C.primary }} strokeWidth={2}>
      <circle cx={x} cy={y} r={r} style={{ fill: C.soft }} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4
        return <line key={i} x1={x + Math.cos(a) * (r + 4)} y1={y + Math.sin(a) * (r + 4)} x2={x + Math.cos(a) * (r + 10)} y2={y + Math.sin(a) * (r + 10)} />
      })}
    </g>
  )
}
