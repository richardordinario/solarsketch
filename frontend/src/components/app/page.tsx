import type { ReactNode } from 'react'

import { SectionLabel } from '@/components/lab/shared'
import { cn } from '@/lib/utils'

/** Scrollable content page used by every screen except the Virtual Lab. */
export function Page({ eyebrow, title, description, actions, children, wide }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className={cn('mx-auto px-6 pt-6 pb-16', wide ? 'max-w-[1120px]' : 'max-w-[880px]')}>
        <header className="mb-6 flex flex-wrap items-end gap-4 edge-b pb-4">
          <div className="min-w-0 flex-1">
            {eyebrow && <SectionLabel className="mb-1">{eyebrow}</SectionLabel>}
            <h1 className="m-0 text-[26px] leading-tight font-strong tracking-[-0.02em]">{title}</h1>
            {description && <p className="mt-1.5 mb-0 max-w-[640px] text-[14px] text-pretty text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  )
}

export function PageSection({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mb-8', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        {aside && <div className="text-[11px] text-muted-foreground">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

/** Bordered list container whose rows are separated by rule lines. */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('edge [&>*+*]:border-t [&>*+*]:border-rule', className)}>{children}</div>
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'warning'; children: ReactNode }) {
  return (
    <div
      className={cn('mb-6 px-3 py-2.5 text-[12px] text-pretty', tone === 'warning' ? '[border:var(--fix-border)] bg-(--fix-bg)' : '[border:var(--note-border)] bg-note text-note-fg')}
    >
      {children}
    </div>
  )
}

/** Small square status chip. */
export function Chip({ tone = 'neutral', children }: { tone?: 'neutral' | 'done' | 'primary' | 'locked'; children: ReactNode }) {
  const cls = {
    neutral: 'edge text-muted-foreground',
    done: 'bg-secondary text-secondary-foreground',
    primary: 'bg-primary text-white',
    locked: 'edge border-dashed text-subtle',
  }[tone]
  return <span className={cn('inline-flex flex-none items-center px-1.5 py-0.5 text-[10px] font-strong tracking-[.06em] whitespace-nowrap uppercase', cls)}>{children}</span>
}
