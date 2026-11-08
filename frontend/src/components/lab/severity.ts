import type { Severity } from '@/engine/types'

export const SEV_COLOR: Record<Severity, string> = { critical: 'var(--critical)', warning: 'var(--warning)', info: 'var(--muted-foreground)' }
export const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' }
