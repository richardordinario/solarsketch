import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { RAIL_W } from './drawers'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { t } from '@/i18n'

/** Uppercase micro-heading used in the sidebars. */
export function SectionLabel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('text-[10px] font-strong tracking-[.08em] text-muted-foreground uppercase', className)}>{children}</div>
}

/** 32×30 square toolbar button with a shadcn tooltip. */
export function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              'h-[30px] w-8 p-0 active:translate-y-0 disabled:pointer-events-auto disabled:cursor-default disabled:opacity-45',
              active === undefined
                ? 'text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted'
                : cn(
                    // Tools: hover fills in dark, draws an inset outline in light.
                    'hover:[outline:var(--tool-hover-outline)] hover:outline-offset-[-2px]',
                    active
                      ? 'bg-secondary text-active-fg hover:bg-(--tool-hover-active-bg) hover:text-active-fg dark:hover:bg-(--tool-hover-active-bg)'
                      : 'text-dim hover:bg-(--tool-hover-bg) hover:text-dim dark:hover:bg-(--tool-hover-bg)',
                  ),
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function ToolDivider() {
  return <div className="mx-1.5 h-(--divider-h) w-(--bw) bg-divider" />
}

/**
 * Grid cell for a side drawer. The column width animates; the drawer keeps its full width and is
 * clipped, so it slides in from its outer edge instead of reflowing while the column changes.
 */
export function DrawerSlot({ side, hidden, children }: { side: 'left' | 'right'; /** Column collapsed to 0: keep it out of the tab order. */ hidden?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-h-0 min-w-0 overflow-hidden bg-background', side === 'right' && 'justify-end')} inert={hidden}>
      {children}
    </div>
  )
}

/** Collapse/expand chevron for a side panel. The chevron points the way the panel will move. */
export function PanelToggle({ side, open, label, onClick, className }: { side: 'left' | 'right'; open: boolean; label: string; onClick: () => void; className?: string }) {
  const title = t(open ? 'Collapse {panel}' : 'Expand {panel}', { panel: label.toLowerCase() })
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-expanded={open}
      className={cn('h-8 w-8 flex-none p-0 text-dim hover:bg-muted hover:text-foreground active:translate-y-0 dark:hover:bg-muted', className)}
    >
      {(side === 'left') === open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </Button>
  )
}

interface RailEntry {
  label: string
  onExpand: () => void
}

/**
 * A collapsed side panel: a narrow rail with the expand button and the panel name written vertically.
 * `more` stacks other collapsed panels in the same rail (Details and Steps share one when both are closed).
 */
export function CollapsedRail({ side, label, onExpand, more = [] }: RailEntry & { side: 'left' | 'right'; more?: RailEntry[] }) {
  return (
    <aside className={cn('relative z-[1] flex min-h-0 flex-none flex-col items-center bg-background', side === 'left' ? 'edge-r' : 'edge-l')} style={{ width: RAIL_W }}>
      {[{ label, onExpand }, ...more].map((e, i) => (
        <div key={e.label} className={cn('flex flex-col items-center', i > 0 && 'mt-3 w-full edge-t')}>
          <PanelToggle side={side} open={false} label={e.label} onClick={e.onExpand} />
          <button
            type="button"
            onClick={e.onExpand}
            tabIndex={-1}
            className="mt-2 cursor-pointer text-[10px] font-strong tracking-[.08em] whitespace-nowrap text-muted-foreground uppercase [writing-mode:vertical-rl] hover:text-foreground"
          >
            {e.label}
          </button>
        </div>
      ))}
    </aside>
  )
}
