/**
 * Interactive lesson diagrams (PRD Module 1 "Interactive diagrams"). Each widget uses the same
 * constants as the engine (catalog defaults, AMPACITY, COPPER_RESISTIVITY, VOLTAGE_DROP_LIMIT) so
 * the numbers agree with the Virtual Lab. They are educational estimates, not design tools.
 */
import { useState, type ReactNode } from 'react'

import { Slider } from '@/components/ui/slider'
import { AMPACITY, CATALOG, VOLTAGE_DROP_LIMIT } from '@/engine/catalog'
import { DESIGN_MIN_TEMP, PERFORMANCE_FACTOR, STC_TEMP } from '@/engine/pv-model'
import type { ComponentType, Wire } from '@/engine/types'
import { voltageDrop } from '@/engine/validation'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

import { C } from './svg-colors'
import { Svg } from './svg'

// ---------------------------------------------------------------------------
// Shared controls

const spec = (type: ComponentType, key: string) => CATALOG[type].specs.find((s) => s[0] === key)?.[3] ?? 0
const fmt = (v: number, digits = 1) => v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
const GAUGES = Object.keys(AMPACITY).sort((a, b) => parseFloat(a) - parseFloat(b))

function SliderRow({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        className="**:data-[slot=slider-thumb]:border-primary **:data-[slot=slider-track]:bg-secondary/30"
      />
      <span className="text-right font-semibold tabular-nums">
        {fmt(value, step < 1 ? 1 : 0)}
        {unit ? ` ${unit}` : ''}
      </span>
    </label>
  )
}

function Segmented<V extends string | number>({ label, value, options, onChange }: { label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 border-(length:--bw) border-border px-2.5 text-[12px] font-semibold tabular-nums',
              o.value === value ? 'border-primary bg-primary text-white' : 'bg-transparent hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Read-out tiles. `tone` marks a failed check, with a text label so it does not rely on colour. */
function Readouts({ items }: { items: { label: string; value: string; tone?: 'ok' | 'bad' | 'note' }[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] border-t border-rule">
      {items.map((it) => (
        <div key={it.label} className="border-r border-b border-rule px-3 py-2">
          <div className="text-[10px] font-semibold tracking-[.05em] text-muted-foreground uppercase">{it.label}</div>
          <div className={cn('text-[17px] font-strong tabular-nums', it.tone === 'bad' && 'text-critical')}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}

function Checks({ items }: { items: { ok: boolean; text: string }[] }) {
  return (
    <ul className="m-0 list-none space-y-1 border-t border-rule px-4 py-3 text-[13px]">
      {items.map((c) => (
        <li key={c.text} className="flex items-start gap-2">
          <span aria-hidden className="w-4 flex-none font-strong" style={{ color: c.ok ? 'var(--term-pe)' : 'var(--critical)' }}>
            {c.ok ? '✓' : '✕'}
          </span>
          <span className="text-pretty">
            <span className="sr-only">{c.ok ? t('Pass:') : t('Fail:')} </span>
            {c.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Controls({ children }: { children: ReactNode }) {
  return <div className="space-y-3 px-4 py-3">{children}</div>
}

/** A small grid drawing of S × P units (modules or batteries). */
function GridDiagram({ series, parallel, unit, label }: { series: number; parallel: number; unit: 'pv' | 'bat'; label: string }) {
  const cw = unit === 'pv' ? 34 : 46
  const ch = unit === 'pv' ? 46 : 28
  const gap = 14
  const w = Math.max(220, parallel * (cw + gap * 2) + 40)
  const h = series * (ch + gap) + 40
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} label={label} className="block h-auto max-h-[240px] w-full">
      {Array.from({ length: parallel }, (_, p) => {
        const x = 30 + p * (cw + gap * 2)
        return (
          <g key={p}>
            {Array.from({ length: series }, (_, s) => (
              <g key={s}>
                <rect x={x} y={20 + s * (ch + gap)} width={cw} height={ch} strokeWidth={1.5} style={{ fill: unit === 'pv' ? C.field : C.node, stroke: C.fg }} />
                {s < series - 1 && <line x1={x + cw / 2} y1={20 + s * (ch + gap) + ch} x2={x + cw / 2} y2={20 + (s + 1) * (ch + gap)} strokeWidth={2} style={{ stroke: C.neg }} />}
              </g>
            ))}
            <line x1={x + cw / 2} y1={8} x2={x + cw / 2} y2={20} strokeWidth={2.5} style={{ stroke: C.pos }} />
            <line x1={x + cw / 2} y1={20 + series * (ch + gap) - gap} x2={x + cw / 2} y2={h - 8} strokeWidth={2.5} style={{ stroke: C.neg }} />
          </g>
        )
      })}
      <line x1={30 + cw / 2} y1={8} x2={30 + (parallel - 1) * (cw + gap * 2) + cw / 2 + 0.01} y2={8} strokeWidth={2.5} style={{ stroke: C.pos }} />
      <line x1={30 + cw / 2} y1={h - 8} x2={30 + (parallel - 1) * (cw + gap * 2) + cw / 2 + 0.01} y2={h - 8} strokeWidth={2.5} style={{ stroke: C.neg }} />
    </Svg>
  )
}

// ---------------------------------------------------------------------------
// Widgets

/** SolarSketch PV model base P = P_STC × G/1000 × f, with the catalog module's temperature coefficient. */
export function PvOutput() {
  const rated = spec('pv', 'ratedPower')
  const tcP = spec('pv', 'tcP')
  const [g, setG] = useState(800)
  const [count, setCount] = useState(2)
  const [temp, setTemp] = useState(50)
  const per = rated * (g / 1000) * PERFORMANCE_FACTOR
  const heat = per * Math.max(0, 1 + (tcP / 100) * (temp - STC_TEMP))
  return (
    <>
      <Controls>
        <SliderRow label={t('Irradiance')} value={g} min={0} max={1100} step={50} unit="W/m²" onChange={setG} />
        <SliderRow label={t('Modules')} value={count} min={1} max={8} step={1} onChange={setCount} />
        <SliderRow label={t('Cell temperature')} value={temp} min={15} max={75} step={5} unit="°C" onChange={setTemp} />
      </Controls>
      <Readouts
        items={[
          { label: t('Per module'), value: `${fmt(per, 0)} W` },
          { label: t('Array'), value: `${fmt(per * count, 0)} W` },
          { label: t('At this cell temperature'), value: `${fmt(heat * count, 0)} W` },
          { label: t('Energy in 1 h'), value: `${fmt((per * count) / 1000, 2)} kWh` },
        ]}
      />
      <p className="m-0 border-t border-rule px-4 py-2 text-[12px] text-pretty text-muted-foreground">
        {t('SolarSketch model: {w} W module × G ÷ 1000 × {f}, then {c} %/°C for cell temperature above or below 25 °C. The simulator also applies tilt and direction. Educational approximation only.', { w: rated, f: PERFORMANCE_FACTOR, c: tcP })}
      </p>
    </>
  )
}

/** P = V × I and E = P × t, with the smallest conductor in the SolarSketch ampacity table. */
export function PowerEnergy() {
  const [v, setV] = useState(24)
  const [p, setP] = useState(600)
  const [h, setH] = useState(5)
  const i = p / v
  const gauge = GAUGES.find((gg) => AMPACITY[gg] >= i)
  return (
    <>
      <Controls>
        <Segmented
          label={t('Voltage')}
          value={v}
          onChange={setV}
          options={[12, 24, 48, 230].map((x) => ({ value: x, label: `${x} V` }))}
        />
        <SliderRow label={t('Power')} value={p} min={10} max={3000} step={10} unit="W" onChange={setP} />
        <SliderRow label={t('Hours of use')} value={h} min={0.5} max={24} step={0.5} unit="h" onChange={setH} />
      </Controls>
      <Readouts
        items={[
          { label: t('Current I = P ÷ V'), value: `${fmt(i, 1)} A` },
          { label: t('Energy E = P × t'), value: p * h >= 1000 ? `${fmt((p * h) / 1000, 2)} kWh` : `${fmt(p * h, 0)} Wh` },
          { label: t('Smallest conductor'), value: gauge ? `${gauge} mm²` : t('over 50 mm²'), tone: gauge ? undefined : 'bad' },
        ]}
      />
      <p className="m-0 border-t border-rule px-4 py-2 text-[12px] text-pretty text-muted-foreground">
        {t('Conductor from the simplified SolarSketch ampacity table; real sizing also depends on installation conditions and voltage drop.')}
      </p>
    </>
  )
}

/** Series/parallel PV array against the MPPT controller's input limits. */
export function StringCalc() {
  const voc = spec('pv', 'voc')
  const vmp = spec('pv', 'vmp')
  const isc = spec('pv', 'isc')
  const pw = spec('pv', 'ratedPower')
  const maxV = spec('mppt', 'maxPvV')
  const maxI = spec('mppt', 'maxPvI')
  const tcVoc = spec('pv', 'tcVoc')
  const [s, setS] = useState(2)
  const [p, setP] = useState(1)
  const vocT = s * voc
  const vocCold = vocT * (1 + (tcVoc / 100) * (DESIGN_MIN_TEMP - STC_TEMP))
  const iscT = p * isc
  return (
    <>
      <Controls>
        <SliderRow label={t('Modules in series')} value={s} min={1} max={5} step={1} onChange={setS} />
        <SliderRow label={t('Parallel strings')} value={p} min={1} max={4} step={1} onChange={setP} />
      </Controls>
      <div className="grid gap-0 border-t border-rule sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="px-4 py-2 sm:border-r sm:border-rule">
          <GridDiagram series={s} parallel={p} unit="pv" label={t('{s} modules in series, {p} strings in parallel', { s, p })} />
          <div className="text-center text-[12px] font-strong tabular-nums">
            {s}S{p}P · {s * p} × {pw} W = {fmt((s * p * pw) / 1000, 1)} kWp
          </div>
        </div>
        <div>
          <Readouts
            items={[
              { label: 'Voc', value: `${fmt(vocT, 1)} V`, tone: vocT > maxV ? 'bad' : undefined },
              { label: 'Vmp', value: `${fmt(s * vmp, 1)} V` },
              { label: 'Isc', value: `${fmt(iscT, 1)} A`, tone: iscT > maxI ? 'bad' : undefined },
              { label: t('Power at STC'), value: `${fmt(s * p * pw, 0)} W` },
            ]}
          />
          <Checks
            items={[
              { ok: vocT <= maxV, text: t('String Voc {v} V within the controller’s {m} V limit (RAT-001)', { v: fmt(vocT, 1), m: maxV }) },
              { ok: vocCold <= maxV, text: t('Cold-morning Voc at {c} °C, {v} V, within the limit (RAT-012)', { c: DESIGN_MIN_TEMP, v: fmt(vocCold, 1) }) },
              { ok: iscT <= maxI, text: t('Array Isc {i} A within the controller’s {m} A PV input (RAT-009)', { i: fmt(iscT, 1), m: maxI }) },
            ]}
          />
        </div>
      </div>
    </>
  )
}

const BATTERIES = {
  lfp12: { label: 'LiFePO4 12.8 V 100 Ah', v: 12.8, ah: 100, maxC: 50, maxD: 100, dod: 0.8 },
  lfp24: { label: 'LiFePO4 25.6 V 200 Ah', v: spec('bat', 'nomV'), ah: spec('bat', 'ah'), maxC: spec('bat', 'maxC'), maxD: spec('bat', 'maxD'), dod: 0.8 },
  lead12: { label: 'Lead-acid 12 V 100 Ah', v: 12, ah: 100, maxC: 20, maxD: 50, dod: 0.5 },
} as const
type BatKey = keyof typeof BATTERIES

/** Battery bank voltage, capacity, energy and current limits for a series/parallel layout. */
export function BatteryCalc() {
  const [kind, setKind] = useState<BatKey>('lfp12')
  const [s, setS] = useState(2)
  const [p, setP] = useState(2)
  const b = BATTERIES[kind]
  const v = b.v * s
  const ah = b.ah * p
  const kwh = (v * ah) / 1000
  const system = [12, 24, 48].find((x) => Math.abs(v - x) <= 4)
  return (
    <>
      <Controls>
        <Segmented label={t('Battery')} value={kind} onChange={setKind} options={(Object.keys(BATTERIES) as BatKey[]).map((k) => ({ value: k, label: BATTERIES[k].label }))} />
        <SliderRow label={t('Batteries in series')} value={s} min={1} max={4} step={1} onChange={setS} />
        <SliderRow label={t('Parallel strings')} value={p} min={1} max={4} step={1} onChange={setP} />
      </Controls>
      <div className="grid gap-0 border-t border-rule sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="px-4 py-2 sm:border-r sm:border-rule">
          <GridDiagram series={s} parallel={p} unit="bat" label={t('{s} batteries in series, {p} strings in parallel', { s, p })} />
          <div className="text-center text-[12px] font-strong tabular-nums">
            {s}S{p}P · {s * p} {t('batteries')}
          </div>
        </div>
        <div>
          <Readouts
            items={[
              { label: t('Bank voltage'), value: `${fmt(v, 1)} V` },
              { label: t('Capacity'), value: `${fmt(ah, 0)} Ah` },
              { label: t('Energy'), value: `${fmt(kwh, 2)} kWh` },
              { label: t('Usable (typical DoD)'), value: `${fmt(kwh * b.dod, 2)} kWh` },
              { label: t('Max charge'), value: `${fmt(b.maxC * p, 0)} A` },
              { label: t('Max discharge'), value: `${fmt(b.maxD * p, 0)} A` },
            ]}
          />
          <p className="m-0 border-t border-rule px-4 py-2 text-[12px] text-pretty text-muted-foreground">
            {system
              ? t('Matches a nominal {v} V system.', { v: system })
              : t('{v} V does not match a standard 12, 24 or 48 V system.', { v: fmt(v, 1) })}{' '}
            {t('Battery values are illustrative examples; usable energy assumes {d}% depth of discharge.', { d: Math.round(b.dod * 100) })}
          </p>
        </div>
      </div>
    </>
  )
}

/** Round-trip voltage drop and ampacity, using the validator's own voltageDrop() and AMPACITY. */
export function VoltageDropCalc() {
  const [v, setV] = useState(24)
  const [i, setI] = useState(40)
  const [len, setLen] = useState(5)
  const [gauge, setGauge] = useState('10')
  const wire = (g: string): Wire => ({ id: 'calc', a: { n: '', t: '' }, b: { n: '', t: '' }, color: 'auto', gauge: g, length: len })
  const drop = voltageDrop(wire(gauge), i, v)
  const amp = AMPACITY[gauge]
  const smallest = GAUGES.find((g) => AMPACITY[g] >= i && voltageDrop(wire(g), i, v).pct <= VOLTAGE_DROP_LIMIT)
  return (
    <>
      <Controls>
        <Segmented label={t('Circuit voltage')} value={v} onChange={setV} options={[12, 24, 48, 100, 230].map((x) => ({ value: x, label: `${x} V` }))} />
        <SliderRow label={t('Current')} value={i} min={1} max={160} step={1} unit="A" onChange={setI} />
        <SliderRow label={t('One-way length')} value={len} min={1} max={50} step={1} unit="m" onChange={setLen} />
        <Segmented label={t('Conductor')} value={gauge} onChange={setGauge} options={GAUGES.map((g) => ({ value: g, label: `${g} mm²` }))} />
      </Controls>
      <Readouts
        items={[
          { label: t('Voltage drop'), value: `${fmt(drop.volts, 2)} V` },
          { label: t('Drop'), value: `${fmt(drop.pct, 1)} %`, tone: drop.pct > VOLTAGE_DROP_LIMIT ? 'bad' : undefined },
          { label: t('At the load'), value: `${fmt(v - drop.volts, 1)} V` },
          { label: t('Ampacity'), value: `${amp} A`, tone: i > amp ? 'bad' : undefined },
        ]}
      />
      <Checks
        items={[
          { ok: i <= amp, text: t('{g} mm² is rated {a} A for {i} A expected (RAT-004)', { g: gauge, a: amp, i }) },
          { ok: drop.pct <= VOLTAGE_DROP_LIMIT, text: t('Drop {p}% within the {l}% design limit (RAT-007)', { p: fmt(drop.pct, 1), l: VOLTAGE_DROP_LIMIT }) },
        ]}
      />
      <p className="m-0 border-t border-rule px-4 py-2 text-[12px] text-pretty text-muted-foreground">
        {smallest ? t('Smallest conductor that passes both checks: {g} mm².', { g: smallest }) : t('No conductor in the table passes both checks. Shorten the run or raise the circuit voltage.')}{' '}
        {t('Drop = 2 × length × current × 0.0175 ÷ area (copper, round trip).')}
      </p>
    </>
  )
}

const SIZING_LOADS: { type: ComponentType; qty: number; hours: number }[] = [
  { type: 'led', qty: 1, hours: 5 },
  { type: 'fan', qty: 2, hours: 8 },
  { type: 'fridge', qty: 1, hours: 12 },
  { type: 'tv', qty: 1, hours: 4 },
  { type: 'router', qty: 1, hours: 24 },
  { type: 'laptop', qty: 0, hours: 4 },
  { type: 'wash', qty: 0, hours: 1 },
  { type: 'pump', qty: 0, hours: 1 },
]

/** Daily load → battery, PV and inverter sizes, with the simplified formulas from the lesson. */
export function LoadSizing() {
  const [rows, setRows] = useState(SIZING_LOADS)
  const [psh, setPsh] = useState(4.5)
  const [autonomy, setAutonomy] = useState(1)
  const [sysV, setSysV] = useState(24)
  const derate = 0.7
  const dod = 0.8
  const invEff = 0.93
  const set = (i: number, patch: Partial<(typeof SIZING_LOADS)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const watts = (type: ComponentType) => spec(type, 'p')
  const daily = rows.reduce((a, r) => a + watts(r.type) * r.qty * r.hours, 0)
  const peak = rows.reduce((a, r) => a + watts(r.type) * r.qty, 0)
  const batKwh = (daily * autonomy) / (dod * invEff) / 1000
  const batAh = (batKwh * 1000) / (sysV === 24 ? 25.6 : 51.2)
  const pvW = daily / (psh * derate)
  const modW = spec('pv', 'ratedPower')
  const num = 'h-7 w-14 border-(length:--bw) border-border bg-field px-1.5 text-right text-[13px] tabular-nums'
  return (
    <>
      <div className="overflow-x-auto px-4 py-3">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[10px] tracking-[.05em] text-muted-foreground uppercase">
              <th className="pb-1 font-semibold">{t('Appliance')}</th>
              <th className="pb-1 text-right font-semibold">W</th>
              <th className="pb-1 text-right font-semibold">{t('Qty')}</th>
              <th className="pb-1 text-right font-semibold">{t('h/day')}</th>
              <th className="pb-1 text-right font-semibold">Wh</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.type} className="border-t border-rule">
                <td className="py-1">{CATALOG[r.type].name}</td>
                <td className="py-1 text-right tabular-nums">{watts(r.type)}</td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    max={9}
                    aria-label={t('{name} quantity', { name: CATALOG[r.type].name })}
                    className={num}
                    value={r.qty}
                    onChange={(e) => set(i, { qty: Math.max(0, Math.min(9, Math.round(+e.target.value || 0))) })}
                  />
                </td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    aria-label={t('{name} hours per day', { name: CATALOG[r.type].name })}
                    className={num}
                    value={r.hours}
                    onChange={(e) => set(i, { hours: Math.max(0, Math.min(24, +e.target.value || 0)) })}
                  />
                </td>
                <td className="py-1 text-right font-semibold tabular-nums">{fmt(watts(r.type) * r.qty * r.hours, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Controls>
        <SliderRow label={t('Peak sun hours')} value={psh} min={3} max={6} step={0.5} unit="h" onChange={setPsh} />
        <SliderRow label={t('Days of autonomy')} value={autonomy} min={1} max={3} step={1} onChange={setAutonomy} />
        <Segmented label={t('System voltage')} value={sysV} onChange={setSysV} options={[24, 48].map((x) => ({ value: x, label: `${x} V` }))} />
      </Controls>
      <Readouts
        items={[
          { label: t('Daily energy'), value: `${fmt(daily / 1000, 2)} kWh` },
          { label: t('All loads at once'), value: `${fmt(peak, 0)} W` },
          { label: t('Inverter (≥ 1.25 ×)'), value: `${fmt(peak * 1.25, 0)} W` },
          { label: t('Battery'), value: `${fmt(batKwh, 1)} kWh` },
          { label: t('Battery at {v} V', { v: sysV === 24 ? 25.6 : 51.2 }), value: `${fmt(batAh, 0)} Ah` },
          { label: t('PV array'), value: `${fmt(pvW, 0)} W` },
          { label: t('{w} W modules', { w: modW }), value: String(Math.ceil(pvW / modW)) },
        ]}
      />
      <p className="m-0 border-t border-rule px-4 py-2 text-[12px] text-pretty text-muted-foreground">
        {t('Assumes {d}% depth of discharge, {e}% inverter efficiency and a {f} derating factor. A refrigerator’s compressor cycles, so enter its running hours, or use its energy label. Educational estimate only; a real design needs measured data and a qualified designer.', {
          d: dod * 100,
          e: invEff * 100,
          f: derate,
        })}
      </p>
    </>
  )
}
