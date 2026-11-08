import { useId, type ReactNode } from 'react'

import { C } from './svg-colors'

/** Arrowhead marker; returns the `url(#id)` to use as markerEnd. */
export function useArrow(color: string = C.fg): [ReactNode, string] {
  const id = useId().replace(/:/g, '')
  const def = (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" style={{ fill: color }} />
      </marker>
    </defs>
  )
  return [def, `url(#${id})`]
}
