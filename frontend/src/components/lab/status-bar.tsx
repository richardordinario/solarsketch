import { CATALOG_VERSION, RULESET_VERSION } from '@/engine/catalog'
import { useLabStore, useValidation } from '@/store/lab-store'
import { AUTHOR } from '@/lib/credits'
import { t } from '@/i18n'

const CELL = 'border-r border-rule px-3'

export function StatusBar() {
  const mouse = useLabStore((s) => s.mouse)
  const nodeCount = useLabStore((s) => s.nodes.length)
  const wireCount = useLabStore((s) => s.wires.length)
  const selCount = useLabStore((s) => s.sel.nodes.length)
  const running = useLabStore((s) => s.running)
  const started = useLabStore((s) => s.sim.started)
  const crit = useValidation().issues.some((i) => i.sev === 'critical')

  const simState = t(running ? 'Simulation running' : started ? 'Simulation paused' : crit ? 'Blocked by critical findings' : 'Ready to simulate')

  return (
    <footer className="flex min-w-0 items-center overflow-hidden edge-t text-[11px] font-semibold whitespace-nowrap tabular-nums">
      <div className={CELL}>
        X {Math.round(mouse.x)} · Y {Math.round(mouse.y)}
      </div>
      <div className={CELL}>
        {t('{n} components · {w} wires', { n: nodeCount, w: wireCount })}
        {selCount ? ` · ${t('{n} selected', { n: selCount })}` : ''}
      </div>
      <div className={CELL}>
        {t('Rules v{r} · Catalog {c}', { r: RULESET_VERSION, c: CATALOG_VERSION })}
      </div>
      <div className={CELL} style={{ color: crit && !running ? 'var(--critical)' : 'var(--foreground)' }}>
        {simState}
      </div>
      <div className="flex-1" />
      <div className="hidden border-l border-rule px-3 text-muted-foreground lg:block">{t('Built by {name}', { name: AUTHOR })}</div>
      <div className="truncate px-3 text-muted-foreground">{t('Educational simulation. Does not certify an installation or indicate PEC compliance.')}</div>
    </footer>
  )
}
