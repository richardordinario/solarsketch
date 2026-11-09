import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useDrawerContent } from '@/hooks/use-drawer-content'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { taskById } from '@/content/tasks'
import { CATALOG, DOMAIN_LABEL, LOAD_TYPES, SWITCH_SPEC, VOLTAGE_DROP_LIMIT, isBattery, isPv } from '@/engine/catalog'
import { DESIGN_MIN_TEMP } from '@/engine/pv-model'
import { terminal, terminalName, wireRoutes } from '@/engine/geometry'
import { matchesProfile, nodeTitle, profileById, profilesFor, type EquipmentProfile } from '@/engine/profiles'
import { measureNode } from '@/engine/measure'
import { estimateCost, peso } from '@/engine/pricing'
import { fixFor, ruleById } from '@/engine/rules'
import { PERFORMANCE_FACTOR, clockStr, compute } from '@/engine/simulation'
import type { LabNode, TermRef, Wire, WireColor } from '@/engine/types'
import { checkWire, nodeMap, wireLength, type NodeMap, type StageResult, type ValidationResult } from '@/engine/validation'
import { useCatalogStore } from '@/store/catalog-store'
import { confirmDelete } from '@/store/confirm-store'
import { useLabStore, useValidation } from '@/store/lab-store'

import { TERMINAL_COLOR } from './colors'
import { NodePhoto } from './device-photo'
import { SEV_COLOR, SEV_LABEL } from './severity'
import { SevIcon } from './sev-icon'
import { CollapsedRail, PanelToggle, SectionLabel } from './shared'
import { DRAWER_W } from './drawers'
import { t } from '@/i18n'

const ROW = 'border-b border-rule'
const OUTLINE_BTN = 'h-7 flex-1 justify-start border-(length:--bw) border-border bg-transparent px-3 text-[12px] font-semibold hover:bg-muted active:translate-y-0 dark:bg-transparent dark:hover:bg-muted'

const GAUGES = [
  { value: '2.5', label: '2.5 mm² · 24 A' },
  { value: '4', label: '4 mm² · 32 A' },
  { value: '6', label: '6 mm² · 41 A' },
  { value: '10', label: '10 mm² · 57 A' },
  { value: '16', label: '16 mm² · 76 A' },
  { value: '25', label: '25 mm² · 101 A' },
  { value: '35', label: '35 mm² · 125 A' },
  { value: '50', label: '50 mm² · 151 A' },
]
const COLORS: { value: WireColor; label: string }[] = [
  { value: 'auto', label: t('Auto (by terminal)') },
  { value: 'red', label: t('Red') },
  { value: 'black', label: t('Black') },
  { value: 'brown', label: t('Brown') },
  { value: 'blue', label: t('Blue') },
  { value: 'gy', label: t('Green / yellow') },
]

function ProjectSummary({ v }: { v: ValidationResult }) {
  const nodes = useLabStore((s) => s.nodes)
  const wireCount = useLabStore((s) => s.wires.length)
  const projectName = useLabStore((s) => s.projectName)
  const pv = nodes.filter(isPv)
  const bats = nodes.filter(isBattery)
  const bank = v.sys.bank ?? v.sys.invBank
  const inv = nodes.find((n) => n.type === 'inv' || n.type === 'hyb' || n.type === 'gti')
  const loads = nodes.filter((n) => LOAD_TYPES.includes(n.type))
  const strings = [...v.sys.strings, ...(v.sys.ac.hyb?.strings ?? []), ...v.sys.ac.gtis.flatMap((g) => g.strings)]

  const summary = [
    { k: 'PV array', v: `${pv.length} × ${pv[0] ? pv[0].specs.ratedPower : 0} W · ${(pv.reduce((a, p) => a + p.specs.ratedPower, 0) / 1000).toFixed(2)} kWp` },
    {
      k: 'Strings',
      v: strings.length
        ? strings.map((s) => `${s.length}S`).join(' + ') + ` · Voc ${Math.max(...strings.map((s) => s.reduce((a, p) => a + p.specs.voc, 0))).toFixed(1)} V`
        : t('None complete'),
    },
    {
      k: 'Battery bank',
      v: bank ? `${bank.strings[0].length}S${bank.strings.length}P · ${bank.nomV} V · ${bank.kwh.toFixed(2)} kWh` : bats.length ? t(bats.length > 1 ? '{n} batteries, not connected' : '{n} battery, not connected', { n: bats.length }) : t('None'),
    },
    { k: 'Inverter', v: inv ? `${CATALOG[inv.type].name.replace(' Inverter', '')} · ${inv.specs.ratedP} W${inv.specs.nomV ? ` · ${inv.specs.nomV} V DC` : ''}` : t('None') },
    { k: 'Connected loads', v: `${loads.length} · ${loads.reduce((a, l) => a + l.specs.p, 0)} W peak` },
    { k: 'Components / wires', v: `${nodes.length} / ${wireCount}` },
  ]
  const cost = estimateCost(nodes)

  return (
    <div>
      <div className="edge-b px-3 py-2">
        <SectionLabel>{t('Project')}</SectionLabel>
        <div className="text-[14px] font-strong tracking-[-0.01em]">{projectName}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{t('Nothing selected. Click a component or wire to inspect it.')}</div>
      </div>
      <SectionLabel className="px-3 pt-2.5 pb-0.5">{t('System summary')}</SectionLabel>
      {summary.map((s) => (
        <div key={s.k} className={`flex justify-between gap-3 px-3 py-1 ${ROW}`}>
          <span className="text-muted-foreground">{t(s.k)}</span>
          <span className="text-right font-semibold tabular-nums">{s.v}</span>
        </div>
      ))}
      <SectionLabel className="px-3 pt-3 pb-0.5">{t('Estimated cost')}</SectionLabel>
      {cost.lines.length ? (
        <>
          {cost.lines.map((l) => (
            <div key={l.type} className={`flex justify-between gap-3 px-3 py-1 ${ROW}`}>
              <span className="text-muted-foreground">
                {l.qty} × {l.name}
              </span>
              <span className="text-right font-semibold tabular-nums">{peso(l.amount)}</span>
            </div>
          ))}
          {cost.appliances > 0 && (
            <>
              <div className={`flex justify-between gap-3 px-3 py-1 ${ROW}`}>
                <span className="text-muted-foreground">{t('Solar and electrical equipment')}</span>
                <span className="text-right font-semibold tabular-nums">{peso(cost.equipment)}</span>
              </div>
              <div className={`flex justify-between gap-3 px-3 py-1 ${ROW}`}>
                <span className="text-muted-foreground">{t('Appliances (loads)')}</span>
                <span className="text-right font-semibold tabular-nums">{peso(cost.appliances)}</span>
              </div>
            </>
          )}
          <div className={`flex justify-between gap-3 px-3 py-1.5 ${ROW}`}>
            <span className="font-strong">{t('Total estimate')}</span>
            <span className="text-right font-strong tabular-nums">{peso(cost.total)}</span>
          </div>
        </>
      ) : (
        <div className={`px-3 py-1 text-muted-foreground ${ROW}`}>{t('No priced components yet.')}</div>
      )}
      <div className="px-3 pt-1.5 pb-1 text-[11px] text-pretty text-muted-foreground">
        {t('Example prices for learning, not a quote. Excludes the utility grid service, the grounding rod, wiring and labour.')}
      </div>
      <SectionLabel className="px-3 pt-3 pb-0.5">{t('Simulation model')}</SectionLabel>
      <div className="mx-3 mt-1 mb-2 edge px-3 py-2 text-[12px] font-strong tabular-nums">
        P<sub>PV</sub> = P<sub>STC</sub> × (G ÷ 1000) × f × f<sub>T</sub> × f<sub>O</sub>
      </div>
      <div className="flex flex-col gap-1 px-3 pb-3 text-xs text-pretty text-muted-foreground">
        <div>{t('f = {f} combined performance factor (soiling, wiring, mismatch; not temperature or orientation).', { f: PERFORMANCE_FACTOR.toFixed(2) })}</div>
        <div>{t('Clear-sky irradiance from 06:00 to 18:00, scaled by sky clearness.')}</div>
        <div>{t('f_T: cell temperature = ambient (24–32 °C daily cycle) + (NOCT − 20) ÷ 800 × G; power changes by the module’s temperature coefficient from 25 °C.')}</div>
        <div>{t('f_O: fixed orientation factor from tilt and azimuth for a site near 12° N; bifacial modules add their rear-side gain.')}</div>
        <div>{t('Controller input limits are also checked at the Voc of a {t} °C morning (colder at highland sites).', { t: DESIGN_MIN_TEMP })}</div>
        <div>{t('Shading only through injected faults. Battery voltage is the resting voltage of its chemistry at the current SOC (no sag under load).')}</div>
        <div>{t('Loads follow fixed daily schedules.')}</div>
        <div>{t('This simplified model does not replace a detailed PV performance model.')}</div>
      </div>
      <div className="mx-3 mt-1 mb-4 [border:var(--note-border)] bg-note px-3 py-2 text-[11px] text-pretty text-note-fg">
        {t('SolarSketch is an educational simulation. A passing result does not certify an installation as safe, PEC-compliant or professionally approved.')}
      </div>
    </div>
  )
}

/** Number field that keeps a local draft so partial input like "4." or "" doesn't snap back. */
/** Rule title, reference and review status from the rule registry. */
function RuleReference({ id }: { id: string }) {
  const rule = ruleById(id)
  if (!rule) return null
  return (
    <div className="mt-1 text-[10px] text-pretty text-muted-foreground" title={rule.explanation}>
      Ref: {rule.reference} · rule v{rule.version} · pending professional review
    </div>
  )
}

function SpecInput({ value, label, onCommit }: { value: number; label: string; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    if (parseFloat(draft) !== value) setDraft(String(value))
  }
  return (
    <Input
      type="number"
      step="any"
      aria-label={label}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = parseFloat(e.target.value)
        if (!isNaN(n) && n !== value) onCommit(n)
      }}
      className="h-6 w-[68px] border-(length:--bw) border-border bg-field px-1.5 text-right text-[12px] font-semibold tabular-nums select-text focus-visible:ring-0 md:text-[12px] dark:bg-field"
    />
  )
}

function ProfileNote({ profile }: { profile: EquipmentProfile }) {
  if (profile.example) return <div className="mt-1 text-[10px] text-pretty text-muted-foreground">{t('Example profile with illustrative values. Check the manufacturer datasheet before relying on it.')}</div>
  const specLabel = (k: string) => CATALOG[profile.type].specs.find((s) => s[0] === k)?.[1] ?? k
  return (
    <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-pretty text-muted-foreground">
      <div>
        {t('Values from the {b} datasheet ({r}), retrieved {d}.', { b: profile.brand, r: profile.source?.revision ?? '', d: profile.source?.retrieved ?? '' })}
        {!profile.reviewed && ` ${t('Not yet reviewed: check the datasheet before relying on them.')}`}{' '}
        {profile.source && (
          <a href={profile.source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">
            {t('Open datasheet')}
          </a>
        )}
      </div>
      {Object.entries(profile.adjustable ?? {}).map(([k, vals]) => (
        <div key={k}>
          {t('{spec} can be set to {values} {unit}.', { spec: t(specLabel(k)), values: vals.join(' / '), unit: CATALOG[profile.type].specs.find((s) => s[0] === k)?.[2] ?? '' })}
        </div>
      ))}
      {profile.settings?.length ? <div>{t('Installer settings, not datasheet values: {list}.', { list: profile.settings.map((k) => t(specLabel(k))).join(', ') })}</div> : null}
      {profile.missing?.length ? <div>{t('Not published: {list} (shown as 0, not checked).', { list: profile.missing.map((k) => t(specLabel(k))).join(', ') })}</div> : null}
      {profile.notes && <div>{profile.notes}</div>}
    </div>
  )
}

/** Technician readings and maintenance actions (P2 fault scenarios). */
function FieldTests({ node, v }: { node: LabNode; v: ValidationResult }) {
  const sim = useLabStore((s) => s.sim)
  const clear = useLabStore((s) => s.clear)
  const faults = useLabStore((s) => s.faults)
  const { repairNode, resetRcd } = useLabStore.getState()
  const m = compute(sim, v, clear, faults)
  const readings = measureNode(node, sim, m, v, faults)
  const rcdTripped = (node.type === 'acdb' || node.type === 'rccb') && (sim.rcdTripped ?? []).includes(node.id)
  return (
    <div>
      <SectionLabel className="px-3 pt-2.5 pb-0.5">{t('Measurements')}</SectionLabel>
      {!sim.started && <div className="px-3 pb-1 text-[11px] text-muted-foreground">{t('Readings at {time}. Run the simulation to see them change.', { time: clockStr(sim.t) })}</div>}
      {readings.map((r) => (
        <div key={r.label} className={`flex justify-between gap-3 px-3 py-1 ${ROW}`}>
          <span className="text-muted-foreground">{t(r.label)}</span>
          <span className="text-right font-semibold tabular-nums" style={{ color: r.abnormal ? 'var(--critical)' : undefined }}>
            {r.abnormal && <span aria-label={t('Abnormal reading')}>▲ </span>}
            {r.value}
          </span>
        </div>
      ))}
      <div className="flex gap-2 px-3 pt-2">
        <Button variant="outline" onClick={() => repairNode(node.id)} className={OUTLINE_BTN} title={t('Inspect the component and repair any fault found')}>
          {t('Inspect and repair')}
        </Button>
        {rcdTripped && (
          <Button variant="outline" onClick={() => resetRcd(node.id)} className={OUTLINE_BTN}>
            {t('Reset RCD')}
          </Button>
        )}
      </div>
    </div>
  )
}

function NodeInspector({ node, v, nm }: { node: LabNode; v: ValidationResult; nm: NodeMap }) {
  const wires = useLabStore((s) => s.wires)
  const { updateSpec, applyProfile, rotate } = useLabStore.getState()
  const c = CATALOG[node.type]
  // Re-render when imported catalogs change.
  useCatalogStore((st) => st.catalogs)
  const profiles = profilesFor(node.type)
  // Older or catalog-default components have no stored profile; recognise an exact match.
  const profile = profileById(node.profile) ?? profiles.find((p) => matchesProfile(node.specs, p))

  const connected: Record<string, TermRef[]> = {}
  wires.forEach((w) => {
    ;(connected[w.a.n + ':' + w.a.t] ??= []).push(w.b)
    ;(connected[w.b.n + ':' + w.b.t] ??= []).push(w.a)
  })
  const issues = v.issues.filter((i) => i.target.node === node.id)

  return (
    <div>
      <div className="flex items-center gap-3 edge-b px-3 py-2">
        <div className="flex h-8 w-10 flex-none items-center justify-center bg-secondary text-[11px] font-strong text-secondary-foreground">{c.code}</div>
        <div className="min-w-0">
          <div className="text-base font-strong tracking-[-0.01em]">{nodeTitle(node)}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.cat} · {profile ? (profile.example ? `${profile.brand} ${profile.model}` : c.name) : c.model} · spec v{node.ver}
          </div>
        </div>
      </div>
      <NodePhoto type={node.type} profileId={profile?.id} name={nodeTitle(node)} />

      {profiles.length > 0 && (
        <div className={`px-3 py-1.5 ${ROW}`}>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{t('Equipment profile')}</span>
            <InspectorSelect
              className="w-full min-w-0 [&_[data-slot=select-value]]:truncate"
              value={profile?.id ?? 'custom'}
              items={[{ value: 'custom', label: t('Custom specifications') }, ...profiles.map((p) => ({ value: p.id, label: `${p.brand} ${p.model}` }))]}
              onChange={(id) => id !== 'custom' && applyProfile(node.id, id)}
            />
          </div>
          {profile && <ProfileNote profile={profile} />}
        </div>
      )}

      <SectionLabel className="px-3 pt-2.5 pb-0.5">{t('Specifications')}</SectionLabel>
      {c.specs.map(([key, label, unit]) =>
        key === SWITCH_SPEC ? (
          // On/off position of an isolator, disconnect or breaker (1 = closed).
          <div key={key} className={`grid grid-cols-[minmax(0,1fr)_98px] items-center gap-2 px-3 py-1 ${ROW}`}>
            <span className="text-label">{t(label)}</span>
            <button
              type="button"
              role="switch"
              aria-checked={node.specs[key] !== 0}
              aria-label={t(label)}
              onClick={() => updateSpec(node.id, key, node.specs[key] === 0 ? 1 : 0)}
              className="h-7 edge px-2 text-[12px] font-semibold hover:bg-muted"
              style={{ color: node.specs[key] === 0 ? 'var(--critical)' : undefined }}
            >
              {node.specs[key] === 0 ? t('Open (off)') : t('Closed (on)')}
            </button>
          </div>
        ) : (
          <label key={key} className={`grid grid-cols-[minmax(0,1fr)_68px_30px] items-center gap-2 px-3 py-1 ${ROW}`}>
            <span className="text-label">{t(label)}</span>
            <SpecInput value={node.specs[key]} label={label} onCommit={(val) => updateSpec(node.id, key, val)} />
            <span className="text-[11px] text-muted-foreground">{unit}</span>
          </label>
        ),
      )}

      <SectionLabel className="px-3 pt-2.5 pb-0.5">{t('Terminals')}</SectionLabel>
      {c.L.concat(c.R).map(([tid, label, type]) => {
        const list = connected[node.id + ':' + tid] ?? []
        return (
          <div key={tid} className={`grid grid-cols-[14px_56px_minmax(0,1fr)] items-start gap-2 px-3 py-1 ${ROW}`}>
            <div className="mt-0.5 size-3" style={{ border: `2px solid ${TERMINAL_COLOR[type]}`, background: list.length ? TERMINAL_COLOR[type] : 'transparent' }} />
            <div>
              <div className="font-strong">{label}</div>
              <div className="text-[10px] text-muted-foreground">{DOMAIN_LABEL[type]}</div>
            </div>
            <div className="text-xs text-pretty" style={{ color: list.length ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              {list.length ? list.map((e) => (nm[e.n] ? terminalName(nm[e.n], e.t) : '')).join(', ') : t('Not connected')}
            </div>
          </div>
        )
      })}

      {issues.length > 0 && (
        <div>
          <SectionLabel className="px-3 pt-2.5 pb-0.5">{t('Findings')}</SectionLabel>
          {issues.map((is, i) => (
            <div key={i} className={`px-3 py-1.5 ${ROW}`}>
              <div className="text-[11px] font-strong" style={{ color: SEV_COLOR[is.sev] }}>
                <SevIcon sev={is.sev} /> {t(SEV_LABEL[is.sev])} · {is.rule}
                {ruleById(is.rule) && <span className="font-semibold text-muted-foreground"> · {ruleById(is.rule)!.title}</span>}
                {is.stage && is.stage <= 6 && <span className="font-semibold text-muted-foreground"> · {t('Stage {n}', { n: is.stage })}</span>}
              </div>
              <div className="mt-0.5 text-pretty">{is.msg}</div>
              <div className="mt-0.5 text-xs text-pretty text-muted-foreground">{fixFor(is)}</div>
              <RuleReference id={is.rule} />
            </div>
          ))}
        </div>
      )}

      <FieldTests node={node} v={v} />

      <SectionLabel className="px-3 pt-2.5 pb-0.5">{t('Documentation')}</SectionLabel>
      <div className="px-3 pt-1 pb-3 text-xs">
        <p className="mb-1 text-pretty">{c.desc}</p>
        {c.constraints.length > 0 && (
          <ul className="mb-1 list-disc pl-4 text-muted-foreground">
            {c.constraints.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        <div className="mb-1 text-muted-foreground">
          {t('Manufacturer')}: {c.maker} · {t('Configurations')}: {c.configs.join(', ')}
        </div>
        <a href="#">{c.doc}</a>
      </div>
      <div className="flex gap-2 px-3 pt-2 pb-4">
        <Button variant="outline" onClick={rotate} className={OUTLINE_BTN}>
          {t('Rotate 90°')}
        </Button>
        <Button variant="outline" onClick={confirmDelete} className={OUTLINE_BTN}>
          {t('Delete')}
        </Button>
      </div>
    </div>
  )
}

function InspectorSelect<T extends string>({ value, items, onChange, className }: { value: T; items: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v != null && onChange(v as T)}>
      <SelectTrigger className={cn('h-7 border-(length:--bw) border-border bg-field px-1.5 text-[12px] font-semibold focus-visible:ring-0 data-[size=default]:h-7 dark:bg-field dark:hover:bg-muted', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="ring-border">
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value} className="text-[12px]">
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const ROUTE_STEP = 10

/** Keyboard-friendly alternative to dragging the wire on the sheet: shift its middle segment. */
function WireRouteRow({ wire, nm }: { wire: Wire; nm: NodeMap }) {
  const wires = useLabStore((s) => s.wires)
  const style = useLabStore((s) => s.settings.wireStyle)
  const { updateWire } = useLabStore.getState()
  const route = wireRoutes(wires, nm, style)[wire.id]
  if (!route) return null
  const x = route.axis === 'x'
  const shift = (dir: 1 | -1) => updateWire(wire.id, { bend: route.bend + dir * ROUTE_STEP })
  const btn = 'h-6 min-w-7 border-(length:--bw) border-border bg-transparent px-1.5 text-[12px] font-semibold hover:bg-muted active:translate-y-0 dark:bg-transparent dark:hover:bg-muted'
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-1 ${ROW}`} title={t('Or drag the wire on the sheet. Double-click its handle to reset.')}>
      <span className="text-muted-foreground">
        {t('Route')} <span className="text-[11px]">· {t(wire.bend === undefined ? 'automatic' : 'manual')}</span>
      </span>
      <div className="flex gap-1">
        <Button variant="outline" className={btn} aria-label={t(x ? 'Move wire left' : 'Move wire up')} onClick={() => shift(-1)}>
          {x ? '◀' : '▲'}
        </Button>
        <Button variant="outline" className={btn} aria-label={t(x ? 'Move wire right' : 'Move wire down')} onClick={() => shift(1)}>
          {x ? '▶' : '▼'}
        </Button>
        <Button variant="outline" className={btn} disabled={wire.bend === undefined} onClick={() => updateWire(wire.id, { bend: undefined })}>
          {t('Auto')}
        </Button>
      </div>
    </div>
  )
}

function WireInspector({ wire, v, nm }: { wire: Wire; v: ValidationResult; nm: NodeMap }) {
  const { updateWire } = useLabStore.getState()
  const r = v.wres[wire.id] ?? checkWire(wire, nm)
  if (!r) return null
  const ta = terminal(nm[wire.a.n], wire.a.t)!
  const tb = terminal(nm[wire.b.n], wire.b.t)!

  // Stages 5 and 6 are system-wide: taken from the validator's ordered stage results.
  const sysStage = (name: string, stage: number): Omit<StageResult, 'ok'> & { ok: boolean | 'warn' } => {
    const hit = v.issues.find((i) => i.stage === stage)
    return { name, ok: hit ? (hit.sev === 'critical' ? false : 'warn') : true, note: hit ? `${t('System:')} ${hit.msg}` : t('System check passed.') }
  }
  const stages = [...r.stages, sysStage('Topology', 5), sysStage('Protection', 6)].map((stage, i) => {
    let st: { name: string; note: string; ok: boolean | 'warn' | null } = stage
    const notRun = st.ok === null
    // A failed ratings stage can be a warning (RAT-004, RAT-007) rather than a fault.
    const warnFail = st.ok === false && i === 3 && r.fail?.sev === 'warning'
    if (warnFail) st = { ...st, ok: 'warn' }
    return {
      n: String(i + 1).padStart(2, '0'),
      name: st.name,
      note: notRun ? t('Not checked: an earlier stage failed.') : st.note,
      mark: notRun ? '–' : st.ok === true ? '✓' : st.ok === 'warn' ? '▲' : '×',
      status: t(notRun ? 'Skipped' : st.ok === true ? 'Pass' : st.ok === 'warn' ? 'Warning' : r.fail && r.fail.sev === 'warning' && i === 3 ? 'Warning' : 'Fail'),
      color: notRun ? 'var(--subtle)' : st.ok === true ? 'var(--foreground)' : st.ok === 'warn' ? 'var(--warning)' : 'var(--critical)',
    }
  })

  return (
    <div>
      <div className="edge-b px-3 py-2">
        <SectionLabel>{t('Wire')} · {DOMAIN_LABEL[ta.t === 'dc' ? tb.t : ta.t]}</SectionLabel>
        <div className="mt-0.5 text-[12px] font-strong tracking-[-0.01em]">{terminalName(nm[wire.a.n], wire.a.t)}</div>
        <div className="text-[11px] text-muted-foreground">{t('to')}</div>
        <div className="text-[12px] font-strong tracking-[-0.01em]">{terminalName(nm[wire.b.n], wire.b.t)}</div>
      </div>
      <div className={`flex justify-between px-3 py-1.5 ${ROW}`}>
        <span className="text-muted-foreground">{t('Expected current')}</span>
        <span className="font-semibold tabular-nums">{r.I ? `${r.I.toFixed(1)} A` : '0 A'}</span>
      </div>
      <div className={`flex items-center justify-between px-3 py-1 ${ROW}`}>
        <span className="text-muted-foreground">{t('Conductor size')}</span>
        <InspectorSelect value={wire.gauge} items={GAUGES} onChange={(gauge) => updateWire(wire.id, { gauge })} />
      </div>
      <label className={`grid grid-cols-[minmax(0,1fr)_76px_30px] items-center gap-2 px-3 py-1 ${ROW}`}>
        <span className="text-muted-foreground">{t('Cable length (one way)')}</span>
        <SpecInput value={wireLength(wire)} label={t('Cable length')} onCommit={(len) => len >= 0.1 && len <= 1000 && updateWire(wire.id, { length: len })} />
        <span className="text-[11px] text-muted-foreground">m</span>
      </label>
      {r.drop && (
        <div className={`flex justify-between px-3 py-1.5 ${ROW}`}>
          <span className="text-muted-foreground">{t('Voltage drop')}</span>
          <span className="font-semibold tabular-nums" style={{ color: r.drop.pct > VOLTAGE_DROP_LIMIT ? 'var(--warning)' : undefined }}>
            {r.drop.volts.toFixed(2)} V · {r.drop.pct.toFixed(1)}% of {r.drop.vNom.toFixed(0)} V
          </span>
        </div>
      )}
      <div className={`flex items-center justify-between px-3 py-1 ${ROW}`}>
        <span className="text-muted-foreground">{t('Wire colour')}</span>
        <InspectorSelect value={wire.color} items={COLORS} onChange={(color) => updateWire(wire.id, { color })} />
      </div>
      <WireRouteRow wire={wire} nm={nm} />

      <SectionLabel className="px-3 pt-2.5 pb-0.5">{t('Connection validation')}</SectionLabel>
      {stages.map((st) => (
        <div key={st.n} className={`grid grid-cols-[20px_22px_minmax(0,1fr)] items-start gap-1.5 px-3 py-1 ${ROW}`}>
          <div className="text-[11px] font-strong text-muted-foreground tabular-nums">{st.n}</div>
          <div className="font-strong" style={{ color: st.color }}>
            {st.mark}
          </div>
          <div>
            <div className="font-semibold">
              {t(st.name)}{' '}
              <span className="text-[11px] font-semibold" style={{ color: st.color }}>
                {st.status}
              </span>
            </div>
            <div className="text-xs text-pretty text-muted-foreground">{st.note}</div>
          </div>
        </div>
      ))}
      {r.fail && (
        <div className="mx-3 mt-3 [border:var(--fix-border)] bg-(--fix-bg) px-3 py-2 text-xs text-pretty">
          <div className="mb-0.5 font-strong">
            {t('Corrective action')} · {r.fail.rule}
            {ruleById(r.fail.rule) && <span className="font-semibold"> {ruleById(r.fail.rule)!.title}</span>}
          </div>
          {fixFor(r.fail)}
          <RuleReference id={r.fail.rule} />
        </div>
      )}
      <div className="px-3 pt-3 pb-4">
        <Button onClick={confirmDelete} className={`${OUTLINE_BTN} w-full border-destructive bg-destructive text-white hover:bg-destructive/85 dark:bg-destructive dark:text-background dark:hover:bg-destructive/85`}>
          {t('Delete wire')}
        </Button>
      </div>
    </div>
  )
}

export function InspectorPanel() {
  const nodes = useLabStore((s) => s.nodes)
  const wires = useLabStore((s) => s.wires)
  const sel = useLabStore((s) => s.sel)
  const open = useLabStore((s) => s.inspectorOpen)
  const toggle = useLabStore((s) => s.toggleInspector)
  const shown = useDrawerContent(open)
  // With a task open and Steps also collapsed, both rails share this one (see VirtualLabPage).
  const stepsDocked = useLabStore((s) => !!s.task && !!taskById(s.task.id) && !s.stepsOpen)
  const toggleSteps = useLabStore((s) => s.toggleSteps)
  const v = useValidation()
  const nm = nodeMap(nodes)

  const node = sel.nodes.length === 1 ? nm[sel.nodes[0]] : undefined
  const wire = !node && sel.wire ? wires.find((w) => w.id === sel.wire) : undefined
  const wireOk = wire && nm[wire.a.n] && nm[wire.b.n]

  if (!shown) return <CollapsedRail side="right" label={t('Details')} onExpand={toggle} more={stepsDocked ? [{ label: t('Steps'), onExpand: toggleSteps }] : []} />

  return (
    <aside className="relative z-[1] flex min-h-0 flex-none flex-col edge-l bg-background text-[12px]" style={{ width: DRAWER_W.inspector }}>
      <div className="flex flex-none items-center edge-b pl-1.5">
        <PanelToggle side="right" open label={t('Details')} onClick={toggle} />
        <SectionLabel className="ml-1">{t('Details')}</SectionLabel>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {node ? <NodeInspector key={node.id} node={node} v={v} nm={nm} /> : wireOk ? <WireInspector wire={wire} v={v} nm={nm} /> : <ProjectSummary v={v} />}
      </div>
    </aside>
  )
}
