import { useState } from 'react'

import { btnGhost, btnOutline } from '@/components/app/styles'
import { Button } from '@/components/ui/button'
import { nodeTitle } from '@/engine/profiles'
import { FAULT_DEFS, FAULT_KINDS, describeFault, isActive, type FaultKind } from '@/engine/faults'
import { clockStr } from '@/engine/simulation'
import { cn } from '@/lib/utils'
import { useLabStore } from '@/store/lab-store'

import { SectionLabel } from './shared'
import { t } from '@/i18n'

const START_OPTIONS: [string, number | null][] = [
  ['Now', null],
  ['At next 08:00', 8],
  ['At next 12:00', 12],
  ['At next 19:00', 19],
]

const field = 'h-7 edge bg-field px-1.5 text-[12px] font-semibold'

/** Console tab for injecting and clearing runtime fault scenarios. */
export function FaultsPanel() {
  const nodes = useLabStore((s) => s.nodes)
  const faults = useLabStore((s) => s.faults)
  const now = useLabStore((s) => s.sim.t)
  const { addFault, removeFault } = useLabStore.getState()
  const [kind, setKind] = useState<FaultKind>('shading')
  const targets = nodes.filter((n) => FAULT_DEFS[kind].appliesTo.includes(n.type))
  const [target, setTarget] = useState('')
  const [start, setStart] = useState(0)
  const [shade, setShade] = useState(50)
  const chosen = targets.some((n) => n.id === target) ? target : (targets[0]?.id ?? '')

  const visible = faults.filter((f) => !f.hidden)
  const hidden = faults.length - visible.length

  const add = () => {
    if (!chosen) return
    const hour = START_OPTIONS[start][1]
    let startAt: number | undefined
    if (hour !== null) {
      startAt = Math.floor(now / 1440) * 1440 + hour * 60
      if (startAt <= now) startAt += 1440
    }
    addFault({ kind, target: chosen, ...(startAt !== undefined ? { startAt } : {}), ...(kind === 'shading' ? { shade: shade / 100 } : {}) })
  }

  return (
    <div className="grid min-h-full grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="edge-r px-3 py-2">
        <SectionLabel className="mb-1.5">{t('Inject a fault')}</SectionLabel>
        <div className="flex flex-col gap-1.5 text-[12px]">
          <label className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2">
            <span className="text-muted-foreground">{t('Fault')}</span>
            <select className={field} value={kind} onChange={(e) => setKind(e.target.value as FaultKind)}>
              {FAULT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(FAULT_DEFS[k].label)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2">
            <span className="text-muted-foreground">{t('Component')}</span>
            <select className={field} value={chosen} onChange={(e) => setTarget(e.target.value)} disabled={!targets.length}>
              {targets.length ? (
                targets.map((n, i) => (
                  <option key={n.id} value={n.id}>
                    {nodeTitle(n)} {targets.filter((x) => x.type === n.type).length > 1 ? `#${i + 1}` : ''}
                  </option>
                ))
              ) : (
                <option value="">{t('No matching component on the sheet')}</option>
              )}
            </select>
          </label>
          <label className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-2">
            <span className="text-muted-foreground">{t('Starts')}</span>
            <select className={field} value={start} onChange={(e) => setStart(+e.target.value)}>
              {START_OPTIONS.map(([l], i) => (
                <option key={l} value={i}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
          {kind === 'shading' && (
            <label className="grid grid-cols-[70px_minmax(0,1fr)_40px] items-center gap-2">
              <span className="text-muted-foreground">{t('Shaded')}</span>
              <input type="range" min={10} max={100} step={10} value={shade} onChange={(e) => setShade(+e.target.value)} className="accent-(--primary)" />
              <span className="tabular-nums">{shade}%</span>
            </label>
          )}
          <p className="m-0 text-[11px] text-pretty text-muted-foreground">{FAULT_DEFS[kind].symptom}</p>
          <div>
            <Button variant="outline" className={btnOutline} disabled={!chosen} onClick={add}>
              {t('Add fault')}
            </Button>
          </div>
        </div>
      </div>
      <div className="px-3 py-2">
        <SectionLabel className="mb-1.5">{t('Faults in this project')}</SectionLabel>
        {!visible.length && <p className="m-0 text-muted-foreground">{t('No injected faults. Faults are saved with the project and take effect while the simulation runs.')}</p>}
        {visible.map((f) => {
          const node = nodes.find((n) => n.id === f.target)
          const active = isActive(f, now)
          return (
            <div key={f.id} className="flex items-start gap-2 border-b border-rule py-1.5">
              <span className={cn('mt-0.5 text-[11px] font-strong', active ? 'text-critical' : 'text-muted-foreground')}>{active ? `■ ${t('Active')}` : `○ ${t('Scheduled')}`}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{describeFault(f, node)}</div>
                <div className="text-[11px] text-pretty text-muted-foreground">
                  {f.startAt !== undefined ? t('From {time}.', { time: clockStr(f.startAt) }) : t('From the start.')}{' '}
                  {t('Fix:')} {FAULT_DEFS[f.kind].repair}
                </div>
              </div>
              <Button variant="ghost" className={cn(btnGhost, 'h-6 px-2 text-[12px]')} onClick={() => removeFault(f.id)}>
                {t('Remove')}
              </Button>
            </div>
          )
        })}
        {hidden > 0 && <p className="mt-2 mb-0 text-[11px] text-muted-foreground">{t(hidden > 1 ? '{n} hidden faults from the challenge. Use Measurements in the inspector to find them.' : '{n} hidden fault from the challenge. Use Measurements in the inspector to find it.', { n: hidden })}</p>}
      </div>
    </div>
  )
}
