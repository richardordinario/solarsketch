import { create } from 'zustand'

import { nodeTitle } from '@/engine/profiles'
import { t } from '@/i18n'
import { useLabStore } from './lab-store'

/** A destructive lab action waiting for the user to confirm it (rendered by `ConfirmDialog`). */
export type ConfirmRequest = { title: string; message: string; action: string; onConfirm: () => void }

export const useConfirmStore = create<{ req: ConfirmRequest | null }>(() => ({ req: null }))

export const askConfirm = (req: ConfirmRequest) => useConfirmStore.setState({ req })
export const closeConfirm = () => useConfirmStore.setState({ req: null })

/** Ask before deleting the current selection (toolbar, Del key, inspector). */
export function confirmDelete() {
  const { sel, nodes, wires, del } = useLabStore.getState()
  if (!sel.nodes.length && !sel.wire) return
  const picked = nodes.filter((n) => sel.nodes.includes(n.id))
  const attached = wires.filter((w) => w.id !== sel.wire && (sel.nodes.includes(w.a.n) || sel.nodes.includes(w.b.n))).length
  const title = !picked.length
    ? t('Delete this wire?')
    : picked.length === 1
      ? t('Delete “{name}”?', { name: nodeTitle(picked[0]) })
      : t('Delete {n} components?', { n: picked.length })
  const parts: string[] = []
  if (picked.length && sel.wire) parts.push(t('The selected wire is deleted too.'))
  if (attached) parts.push(t(attached > 1 ? '{n} connected wires are deleted too.' : '{n} connected wire is deleted too.', { n: attached }))
  parts.push(t('You can undo this with Ctrl+Z.'))
  askConfirm({ title, message: parts.join(' '), action: t('Delete'), onConfirm: del })
}
