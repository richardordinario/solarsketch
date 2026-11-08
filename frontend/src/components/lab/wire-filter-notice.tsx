import { DEFAULT_WIRE_FILTER, isFilterActive } from '@/engine/wire-filter'
import { useWireVisibility } from '@/hooks/use-wire-visibility'
import type { NodeMap, ValidationResult } from '@/engine/validation'
import { cn } from '@/lib/utils'
import { useLabStore } from '@/store/lab-store'
import { t } from '@/i18n'

/** Shown while the wire filter hides or fades wires, so a busy sheet or 3D lab never looks unwired by mistake. */
export function WireFilterNotice({ v, nm, className }: { v: ValidationResult; nm: NodeMap; className?: string }) {
  const filter = useLabStore((s) => s.wireFilter)
  const total = useLabStore((s) => s.wires.length)
  const focusEmpty = useLabStore((s) => s.wireFilter.mode === 'focus' && !s.sel.nodes.length && !s.sel.wire)
  const setWireFilter = useLabStore((s) => s.setWireFilter)
  const vis = useWireVisibility(v, nm)
  if (!isFilterActive(filter)) return null
  const shown = Object.values(vis).filter((x) => x === 'show').length
  return (
    <div onMouseDown={(e) => e.stopPropagation()} className={cn('absolute bottom-2 left-2 flex items-center gap-2 edge bg-background px-2 py-1 text-[11px] font-semibold', className)} role="status">
      <span>
        {filter.mode === 'hidden' ? t('Wires hidden') : t('Showing {n} of {total} wires', { n: shown, total })}
        {focusEmpty && <span className="font-normal text-muted-foreground"> · {t('Select a component to focus its wires')}</span>}
      </span>
      <button type="button" onClick={() => setWireFilter(DEFAULT_WIRE_FILTER)} className="-my-1 -mr-2 cursor-pointer border-0 border-l border-rule bg-transparent px-2 py-1 text-[11px] font-semibold text-primary hover:bg-muted">
        {t('Show all')}
      </button>
    </div>
  )
}
