import type { TerminalType, WireColor } from '@/engine/types'

/** Terminal colour by electrical type. Visual convention only; values switch with the theme. */
export const TERMINAL_COLOR: Record<TerminalType, string> = {
  'dc+': 'var(--term-dc-pos)',
  'dc-': 'var(--term-dc-neg)',
  dc: 'var(--term-dc)',
  'ac-l': 'var(--term-ac-l)',
  'ac-n': 'var(--term-ac-n)',
  pe: 'var(--term-pe)',
}

/** Manual wire colours. `gy` renders as green/yellow stripes. */
export const WIRE_COLOR: Record<Exclude<WireColor, 'auto'>, string> = {
  red: 'var(--term-dc-pos)',
  black: 'var(--term-dc-neg)',
  brown: 'var(--term-ac-l)',
  blue: 'var(--term-ac-n)',
  gy: 'gy',
}
