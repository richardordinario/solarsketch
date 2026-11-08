import type { NodeMap, ValidationResult } from '@/engine/validation'
import { wireVisibility } from '@/engine/wire-filter'
import { useLabStore } from '@/store/lab-store'

/** Per-wire visibility under the sheet's wire filter (engine/wire-filter.ts). */
export function useWireVisibility(v: ValidationResult, nm: NodeMap) {
  const wires = useLabStore((s) => s.wires)
  const sel = useLabStore((s) => s.sel)
  const filter = useLabStore((s) => s.wireFilter)
  return wireVisibility(wires, nm, v, filter, sel)
}
