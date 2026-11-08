import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { useDrawerContent } from '@/hooks/use-drawer-content'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CATALOG, RULESET_VERSION } from '@/engine/catalog'
import { fixFor, ruleById } from '@/engine/rules'
import { terminal } from '@/engine/geometry'
import { HISTORY_POINTS, clockStr, compute, isDaylight, type Measurements as Readings, type SimState } from '@/engine/simulation'
import type { Issue, LabNode } from '@/engine/types'
import type { ValidationResult } from '@/engine/validation'
import { nodeMap } from '@/engine/validation'
import { cn } from '@/lib/utils'
import { tickMinutes, useLabStore, useValidation, type ConsoleTab } from '@/store/lab-store'

import { FaultsPanel } from './faults-panel'
import { ChevronDownIcon, ChevronUpIcon, CloudIcon, MoonIcon, NoonIcon, PartlyCloudyIcon, SunIcon, SunriseIcon, SunsetIcon } from './icons'
import { SEV_COLOR, SEV_LABEL } from './severity'
import { SevIcon } from './sev-icon'
import { t } from '@/i18n'

const JUMPS: [string, number, () => ReactNode][] = [
  ['Sunrise', 6, SunriseIcon],
  ['Noon', 12, NoonIcon],
  ['Sunset', 18, SunsetIcon],
  ['Midnight', 0, MoonIcon],
]
const WEATHER: [string, number, () => ReactNode][] = [
  ['Clear', 100, SunIcon],
  ['Partly cloudy', 60, PartlyCloudyIcon],
  ['Overcast', 20, CloudIcon],
]

/** Square icon button with its name in a hover tooltip. */
function IconToggle({ label, tip, pressed, onClick, children }: { label: string; tip: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn('flex size-7 cursor-pointer items-center justify-center border-0 p-0', pressed ? 'bg-secondary text-active-fg' : 'bg-transparent text-foreground hover:bg-muted')}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{tip}</TooltipContent>
    </Tooltip>
  )
}

/** 24-hour strip: daylight band 06:00–18:00 and the current time. */
function DayTimeline({ t }: { t: number }) {
  const h = (t / 60) % 24
  return (
    <span className="relative inline-block h-2.5 w-[120px] edge bg-[color-mix(in_oklab,var(--foreground)_18%,transparent)]" title={`Simulated time ${clockStr(t)}. Daylight 06:00–18:00.`} aria-hidden>
      <span className="absolute inset-y-0 left-1/4 w-1/2 bg-[color-mix(in_oklab,var(--term-pe-stripe)_70%,var(--background))]" />
      <span className="absolute inset-y-[-3px] w-0.5 bg-primary" style={{ left: `${(h / 24) * 100}%` }} />
    </span>
  )
}

type Tone = 'ok' | 'warn' | 'bad' | 'muted'
const TONE: Record<Tone, string> = { ok: 'var(--foreground)', warn: 'var(--warning)', bad: 'var(--critical)', muted: 'var(--muted-foreground)' }
const TONE_MARK: Record<Tone, string> = { ok: '●', warn: '▲', bad: '■', muted: '○' }

/** One status fact; the shape mark repeats the colour so the state never depends on colour alone. */
function StatusItem({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-strong" style={{ color: TONE[tone] }}>
        <span aria-hidden className="text-[9px]">
          {TONE_MARK[tone]}
        </span>
        {value}
      </span>
    </span>
  )
}

function systemKind(nodes: LabNode[]) {
  if (nodes.some((n) => n.type === 'hyb')) return 'Hybrid'
  if (nodes.some((n) => n.type === 'grid')) return 'Grid-tied'
  if (nodes.some((n) => n.type === 'gen')) return 'Off-grid + generator'
  return 'Off-grid'
}

/** System status summary (PRD §3 Module 2.1 bottom panel): run state, findings and equipment states. */
function SystemStatus({ v, m, sim }: { v: ValidationResult; m: Readings; sim: SimState }) {
  const nodes = useLabStore((s) => s.nodes)
  const running = useLabStore((s) => s.running)
  const stopped = useLabStore((s) => s.stopped)
  const crit = v.issues.filter((i) => i.sev === 'critical').length
  const warn = v.issues.filter((i) => i.sev === 'warning').length

  const run: [string, Tone] = running ? ['Running', 'ok'] : stopped ? ['Stopped', 'muted'] : sim.started ? ['Paused', 'warn'] : crit ? ['Blocked', 'bad'] : ['Ready', 'muted']
  const hasInv = v.sys.inv || v.sys.ac.hyb || v.sys.ac.gtis.length
  const inverter: [string, Tone] | null = !hasInv
    ? null
    : !sim.started
      ? ['Not running', 'muted']
      : m.overload || m.ac.genOverload
        ? ['Overload', 'bad']
        : m.dcOff
          ? ['Off · no DC input', 'bad']
          : m.derated
            ? ['Derated', 'warn']
            : m.invOn || m.ac.gtiAc > 1 || (m.ac.hybMode !== 'off' && m.ac.hybMode !== 'none')
              ? ['On', 'ok']
              : ['Off', 'muted']
  const bank = v.sys.bank ?? v.sys.invBank ?? v.sys.ac.hyb?.bank
  const battery: [string, Tone] | null = !bank
    ? null
    : m.bmsOff
      ? ['BMS cut-off', 'bad']
      : sim.lvd
        ? ['Low-voltage cut-off', 'bad']
        : !sim.started
          ? [`SOC ${sim.soc.toFixed(0)}%`, 'muted']
          : [`${sim.soc.toFixed(0)}% · ${m.pbat > 1 ? t('Charging') : m.pbat < -1 ? t('Discharging') : t('Idle')}`, sim.soc < 20 ? 'warn' : 'ok']
  const grid: [string, Tone] | null = !v.sys.ac.grids.length
    ? null
    : m.ac.gridOut.length
      ? ['Outage', 'bad']
      : !sim.started
        ? ['Connected', 'muted']
        : m.ac.pgrid > 1
          ? ['Importing', 'ok']
          : m.ac.pgrid < -1
            ? ['Exporting', 'ok']
            : ['Connected', 'ok']
  const rcd = (sim.rcdTripped ?? []).length

  return (
    <div role="status" aria-live="polite" aria-label={t('System status')} className="flex flex-wrap items-center gap-x-4 gap-y-1 edge-b px-3 py-1.5 text-[11px] font-semibold">
      <span className="text-xs font-strong">{t('Status')}</span>
      <StatusItem label={t('System')} value={t(systemKind(nodes))} tone="ok" />
      <StatusItem label={t('Simulation')} value={t(run[0])} tone={run[1]} />
      <StatusItem label={t('Critical')} value={String(crit)} tone={crit ? 'bad' : 'muted'} />
      <StatusItem label={t('Warnings')} value={String(warn)} tone={warn ? 'warn' : 'muted'} />
      {inverter && <StatusItem label={t('Inverter')} value={t(inverter[0])} tone={inverter[1]} />}
      {battery && <StatusItem label={t('Battery')} value={battery[0].startsWith('SOC') || /^\d/.test(battery[0]) ? battery[0] : t(battery[0])} tone={battery[1]} />}
      {grid && <StatusItem label={t('Grid')} value={t(grid[0])} tone={grid[1]} />}
      {v.sys.ac.gens.length > 0 && <StatusItem label={t('Generator')} value={t((sim.genOn ?? []).length ? 'Running' : 'Standby')} tone={(sim.genOn ?? []).length ? 'ok' : 'muted'} />}
      {sim.started && m.curtailed && <StatusItem label={t('PV')} value={t('Curtailed')} tone="warn" />}
      {rcd > 0 && <StatusItem label={t('RCD')} value={t('Tripped')} tone="bad" />}
    </div>
  )
}

function Measurements() {
  const sim = useLabStore((s) => s.sim)
  const clear = useLabStore((s) => s.clear)
  const speed = useLabStore((s) => s.speed)
  const setClear = useLabStore((s) => s.setClear)
  const jumpTo = useLabStore((s) => s.jumpToHour)
  const v = useValidation()
  const faults = useLabStore((s) => s.faults)
  const m = compute(sim, v, clear, faults)

  const anyOk = v.sys.ok || v.sys.invOk || v.sys.hybOk || v.sys.acSupplied.length > 0
  const fmt = (x: number, d: number) => (anyOk ? x.toFixed(d) : '—')
  const pbatLbl = t(m.pbat > 1 ? 'Charging' : m.pbat < -1 ? 'Discharging' : 'Idle')
  const nStrings = v.sys.strings.length + (v.sys.ac.hyb?.strings.length ?? 0) + v.sys.ac.gtis.reduce((a, g) => a + g.strings.length, 0)
  const metrics: { label: string; value: string; unit: string; sub: string; color?: string }[] = [
    { label: 'PV generation', value: fmt(m.ppv, 0), unit: 'W', sub: nStrings ? t(nStrings > 1 ? '{n} strings' : '{n} string', { n: nStrings }) : t('PV circuit incomplete'), color: 'var(--critical)' },
    { label: 'PV voltage', value: fmt(m.vpv, 1), unit: 'V', sub: t('At controller input') },
    { label: 'PV current', value: fmt(m.ipv, 2), unit: 'A', sub: t('String current') },
    { label: 'Irradiance', value: m.G.toFixed(0), unit: 'W/m²', sub: t('Sky clearness {p}%', { p: clear }) },
    { label: 'Battery voltage', value: fmt(m.vbat, 1), unit: 'V', sub: v.sys.bank || v.sys.invBank ? t('LiFePO4 · {k} kWh bank', { k: (v.sys.bank ?? v.sys.invBank)!.kwh.toFixed(2) }) : t('No battery') },
    { label: 'State of charge', value: fmt(sim.soc, 0), unit: '%', sub: t(sim.lvd ? 'Low-voltage cut-off' : sim.soc >= 100 ? 'Full' : 'Usable range 10–100%'), color: sim.soc < 20 ? 'var(--critical)' : undefined },
    { label: 'Battery power', value: fmt(m.pbat, 0), unit: 'W', sub: pbatLbl },
    { label: 'Inverter output', value: fmt(m.pload, 0), unit: 'W', sub: m.overload ? t('Overload') : m.invOn ? '230 V · 60 Hz' : t('Off') },
    { label: 'Load consumption', value: fmt(m.pload, 0), unit: 'W', sub: t('{a} of {b} loads on', { a: m.onLoads.length, b: v.sys.acSupplied.length }) },
    { label: 'Energy generated', value: fmt(sim.eGen, 2), unit: 'kWh', sub: t('Since start') },
    { label: 'Energy consumed', value: fmt(sim.eUse, 2), unit: 'kWh', sub: t('Since start') },
    { label: 'System losses', value: fmt(m.loss, 0), unit: 'W', sub: t('Conversion + standby') },
  ]
  const grid = v.sys.ac.grids[0]
  if (grid) {
    const bill = (sim.eImport ?? 0) * grid.specs.tariff - (sim.eExport ?? 0) * grid.specs.credit
    metrics.push(
      {
        label: 'Grid power',
        value: m.ac.gridOut.length ? t('Out') : fmt(Math.abs(m.ac.pgrid), 0),
        unit: m.ac.gridOut.length ? '' : 'W',
        sub: t(m.ac.gridOut.length ? 'Utility outage' : m.ac.pgrid > 1 ? 'Importing' : m.ac.pgrid < -1 ? 'Exporting' : 'Balanced'),
        color: m.ac.gridOut.length ? 'var(--critical)' : undefined,
      },
      { label: 'Energy imported', value: fmt(sim.eImport ?? 0, 2), unit: 'kWh', sub: t('At ₱{r}/kWh', { r: grid.specs.tariff }) },
      { label: 'Energy exported', value: fmt(sim.eExport ?? 0, 2), unit: 'kWh', sub: t('Credited ₱{r}/kWh', { r: grid.specs.credit }) },
      { label: 'Net bill', value: fmt(bill, 2), unit: '₱', sub: t(bill < 0 ? 'Credit since start' : 'Since start (energy only)') },
    )
  }
  if (v.sys.ac.gens.length)
    metrics.push(
      { label: 'Generator', value: fmt(m.ac.pgen, 0), unit: 'W', sub: t((sim.genOn ?? []).length ? 'Running' : 'Standby') },
      { label: 'Fuel used', value: fmt(sim.fuel ?? 0, 2), unit: 'L', sub: t('{h} h run time', { h: (sim.genHours ?? 0).toFixed(1) }) },
    )

  const hist = sim.hist
  const ymax = Math.max(400, ...hist.map((p) => Math.max(p.pv, p.load))) * 1.1
  const pts = (f: (p: (typeof hist)[number]) => number) =>
    hist.map((p, i) => `${((i * 600) / (HISTORY_POINTS - 1)).toFixed(1)},${(136 - f(p) * 128).toFixed(1)}`).join(' ')
  const simStep = useLabStore((s) => s.settings.simStep)
  const from = hist.length ? clockStr(sim.t - hist.length * tickMinutes(simStep, speed)) : ''
  const to = hist.length ? clockStr(sim.t) : ''

  return (
    <div className="flex min-h-full flex-col">
      <SystemStatus v={v} m={m} sim={sim} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 edge-b px-3 py-1.5 text-[11px] font-semibold tabular-nums">
        <span className="text-xs font-strong">{clockStr(sim.t)}</span>
        <span className="text-muted-foreground">{t(isDaylight(sim.t) ? 'Daylight' : 'Night')}</span>
        <DayTimeline t={sim.t} />
        <span className="flex items-center gap-1 text-muted-foreground">
          {t('Jump to')}
          {JUMPS.map(([label, hour, Glyph]) => (
            <IconToggle key={label} label={t(label)} tip={`${t(label)} · ${String(hour).padStart(2, '0')}:00`} onClick={() => jumpTo(hour)}>
              <Glyph />
            </IconToggle>
          ))}
        </span>
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          {WEATHER.map(([label, value, Glyph]) => (
            <IconToggle key={label} label={t(label)} tip={`${t(label)} · ${value}%`} pressed={clear === value} onClick={() => setClear(value)}>
              <Glyph />
            </IconToggle>
          ))}
        </span>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span aria-hidden>{t('Sky clearness')}</span>
          <Slider
            aria-label={t('Sky clearness')}
            value={[clear]}
            min={0}
            max={100}
            onValueChange={(val) => setClear(Array.isArray(val) ? val[0] : val)}
            className="w-24 flex-none data-horizontal:w-24 **:data-[slot=slider-thumb]:border-primary **:data-[slot=slider-track]:bg-secondary"
          />
          <span className="w-[34px] text-right">{clear}%</span>
        </div>
      </div>

      {/* Measurements take the space; the chart grows a third as fast and wraps under them when the console is narrow. */}
      <div className="flex flex-1 flex-wrap">
        <div className="grid min-w-0 flex-[3_1_340px] grid-cols-[repeat(auto-fill,minmax(112px,1fr))] content-start edge-r">
          {metrics.map((mt) => (
            <div key={mt.label} className="min-w-0 border-r border-b border-rule px-3 py-2">
              <div className="truncate text-[10px] font-semibold tracking-[.05em] text-muted-foreground uppercase">{t(mt.label)}</div>
              <div className="flex items-baseline gap-1 tabular-nums">
                <span className="text-xl font-strong tracking-[-0.02em]" style={{ color: mt.color ?? 'var(--foreground)' }}>
                  {mt.value}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">{mt.unit}</span>
              </div>
              <div className="text-[10px] whitespace-nowrap text-muted-foreground">{mt.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex min-h-[180px] min-w-0 flex-[1_1_260px] flex-col px-3.5 py-2.5">
          <div className="mb-1.5 flex items-center gap-3.5 text-[11px] font-semibold">
            <span className="flex-1 text-xs font-strong">{t('Power over time')}</span>
            <span className="flex items-center gap-[5px]"><span className="h-[3px] w-3.5 bg-primary" />PV</span>
            <span className="flex items-center gap-[5px]"><span className="h-[3px] w-3.5 bg-foreground" />{t('Load')}</span>
            <span className="flex items-center gap-[5px]"><span className="w-3.5 border-t-2 border-dashed border-subtle" />SOC</span>
          </div>
          <div className="relative min-h-[90px] flex-1 edge-b edge-l">
            <svg viewBox="0 0 600 140" preserveAspectRatio="none" className="absolute inset-0 size-full">
              <line x1="0" y1="70" x2="600" y2="70" style={{ stroke: 'var(--rule)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <polyline points={pts((p) => p.soc / 100)} fill="none" style={{ stroke: 'var(--subtle)' }} strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              <polyline points={pts((p) => p.load / ymax)} fill="none" style={{ stroke: 'var(--foreground)' }} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <polyline points={pts((p) => p.pv / ymax)} fill="none" style={{ stroke: 'var(--primary)' }} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            {hist.length > 0 ? (
              <div className="absolute top-0.5 left-1 text-[10px] text-muted-foreground tabular-nums">{ymax.toFixed(0)} W · SOC 100%</div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">{t('Run the simulation to record a time series.')}</div>
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{from}</span>
            <span>{to}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const VAL_GRID = 'grid grid-cols-[104px_80px_minmax(0,1.4fr)_minmax(0,1fr)_150px]'

function issueTarget(i: Issue, nm: ReturnType<typeof nodeMap>, wires: ReturnType<typeof useLabStore.getState>['wires']) {
  if (i.target.node && nm[i.target.node]) return CATALOG[nm[i.target.node].type].name
  if (i.target.wire) {
    const w = wires.find((x) => x.id === i.target.wire)
    if (w && nm[w.a.n] && nm[w.b.n]) return 'Wire · ' + terminal(nm[w.a.n], w.a.t)!.label + ' → ' + terminal(nm[w.b.n], w.b.t)!.label
  }
  return '—'
}

function Validation() {
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  const sel = useLabStore((s) => s.sel)
  const select = useLabStore((s) => s.select)
  const { issues } = useValidation()
  const nm = nodeMap(nodes)

  return (
    <div>
      <div className={cn(VAL_GRID, 'sticky top-0 edge-b bg-background px-3.5 py-1.5 text-[10px] font-strong tracking-[.06em] text-muted-foreground uppercase')}>
        <div>{t('Severity')}</div>
        <div>{t('Rule')}</div>
        <div>{t('Finding')}</div>
        <div>{t('Corrective action')}</div>
        <div>{t('Component')}</div>
      </div>
      {issues.map((i, idx) => {
        const active = (i.target.node && sel.nodes.includes(i.target.node)) || (i.target.wire && sel.wire === i.target.wire)
        return (
          <div
            key={idx}
            role="button"
            tabIndex={0}
            onClick={() => select(i.target.node ? { nodes: [i.target.node], wire: null } : { nodes: [], wire: i.target.wire ?? null })}
            className={cn(VAL_GRID, 'cursor-pointer items-start border-b border-rule px-3.5 py-2 hover:bg-muted', active ? 'bg-row-active' : 'bg-transparent')}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-strong" style={{ color: SEV_COLOR[i.sev] }}>
              <SevIcon sev={i.sev} /> {t(SEV_LABEL[i.sev])}
            </div>
            <div className="text-[11px] font-semibold tabular-nums" title={ruleById(i.rule) ? `${ruleById(i.rule)!.title}. Ref: ${ruleById(i.rule)!.reference}` : undefined}>
              {i.rule}
            </div>
            <div className="pr-4 text-pretty">{i.msg}</div>
            <div className="pr-4 text-pretty text-muted-foreground">{fixFor(i)}</div>
            <div className="text-xs font-semibold">{issueTarget(i, nm, wires)}</div>
          </div>
        )
      })}
      {!issues.length && <div className="px-3.5 py-4 text-muted-foreground">{t('No findings for the current configuration under rule set v{v}.', { v: RULESET_VERSION })}</div>}
      <div className="px-3.5 py-2.5 text-[11px] text-muted-foreground">
        {t('Checks run in order: terminal, AC/DC domain, polarity, ratings, topology, protection. Results are educational and do not certify an installation.')}
      </div>
    </div>
  )
}

function EventLog() {
  const log = useLabStore((s) => s.log)
  return (
    <div className="py-1">
      {log.map((lg, i) => (
        <div key={log.length - i} className="grid grid-cols-[90px_24px_minmax(0,1fr)] border-b border-rule px-3.5 py-1 tabular-nums">
          <div className="text-xs text-muted-foreground">{lg.time}</div>
          <div className="flex items-center" style={{ color: SEV_COLOR[lg.sev] }} title={t(SEV_LABEL[lg.sev])}>
            <SevIcon sev={lg.sev} />
          </div>
          <div>{lg.text}</div>
        </div>
      ))}
    </div>
  )
}

export function ConsolePanel() {
  const tab = useLabStore((s) => s.tab)
  const open = useLabStore((s) => s.consoleOpen)
  const logCount = useLabStore((s) => s.log.length)
  const faultCount = useLabStore((s) => s.faults.filter((f) => !f.hidden).length)
  const setTab = useLabStore((s) => s.setTab)
  const toggle = useLabStore((s) => s.toggleConsole)
  const shown = useDrawerContent(open)
  const { issues } = useValidation()

  const tabs: [ConsoleTab, string, string][] = [
    ['meas', 'Measurements', ''],
    ['val', 'Validation', String(issues.length)],
    ['faults', 'Faults', faultCount ? String(faultCount) : ''],
    ['log', 'Event log', String(logCount)],
  ]

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden edge-t">
      <div className="flex h-9 flex-none items-stretch overflow-hidden whitespace-nowrap" style={{ borderBottom: open ? '1px solid var(--border)' : '0' }} role="tablist">
        <div className="flex min-w-0 flex-auto items-stretch">
          {tabs.map(([k, label, count]) => {
            const active = tab === k && open
            return (
              <Button
                key={k}
                role="tab"
                aria-selected={active}
                variant="ghost"
                onClick={() => setTab(k)}
                className={cn(
                  'h-auto min-h-9 flex-none justify-start gap-2 rounded-none border-0 edge-r px-3 text-[13px] font-semibold active:translate-y-0',
                  active ? 'bg-secondary text-active-fg hover:bg-secondary hover:text-active-fg dark:hover:bg-secondary' : 'bg-transparent text-dim hover:bg-muted hover:text-dim dark:hover:bg-muted',
                )}
              >
                {t(label)}
                <span className="text-[11px] tabular-nums opacity-80">{count}</span>
              </Button>
            )
          })}
        </div>
        <Button
          variant="ghost"
          onClick={toggle}
          title={t(open ? 'Collapse console' : 'Expand console')}
          aria-label={t(open ? 'Collapse console' : 'Expand console')}
          className="h-auto w-9 flex-none border-0 edge-l p-0 hover:bg-muted active:translate-y-0 dark:hover:bg-muted"
        >
          {open ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </Button>
      </div>
      {shown && (
        <div className="min-h-0 flex-1 overflow-auto">
          {tab === 'meas' && <Measurements />}
          {tab === 'val' && <Validation />}
          {tab === 'faults' && <FaultsPanel />}
          {tab === 'log' && <EventLog />}
        </div>
      )}
    </section>
  )
}
