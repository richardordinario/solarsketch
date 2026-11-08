import { toast } from 'sonner'

import { SAMPLE_PROJECT_NAME, sampleProject } from '@/engine/sample-project'
import { createProjectDocument, getMeta, initStorage, isStorageAvailable, listProjects, loadProject, saveProject, subscribeToOtherTabs } from '@/storage/repository'
import type { ProjectDocument } from '@/storage/schema'

import { lastWritten, useLabStore } from './lab-store'
import { useCatalogStore } from './catalog-store'
import { useProfileStore } from './profile-store'
import { useProgressStore } from './progress-store'
import { t } from '@/i18n'

const AUTOSAVE_MS = 800

export function newSampleDocument(): ProjectDocument {
  const { nodes, wires } = sampleProject()
  return createProjectDocument({ name: SAMPLE_PROJECT_NAME, nodes, wires })
}

/**
 * Open storage, then the last project, else the newest one, else a new saved sample.
 * Without storage the sample opens in memory only.
 */
export async function bootstrap() {
  await initStorage()
  const open = (doc: ProjectDocument) => useLabStore.getState().loadDocument(doc)
  if (!isStorageAvailable()) return open(newSampleDocument())

  await useProgressStore.getState().reload()
  await useProfileStore.getState().reload().catch(() => undefined)
  await useCatalogStore.getState().reload().catch(() => undefined)
  const meta = await getMeta()
  const last = meta.lastProjectId ? await loadProject(meta.lastProjectId) : null
  if (last) return open(last)

  const newest = (await listProjects()).projects[0]
  const doc = newest ? await loadProject(newest.id) : null
  if (doc) return open(doc)

  const sample = newSampleDocument()
  await saveProject(sample).catch(() => undefined)
  open(sample)
}

/** Debounced autosave of the open project whenever its persisted fields change. */
export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsub = useLabStore.subscribe((s, prev) => {
    if (!s.projectId || s.projectId !== prev.projectId) return
    const changed = s.nodes !== prev.nodes || s.wires !== prev.wires || s.clear !== prev.clear || s.speed !== prev.speed || s.projectName !== prev.projectName || s.task !== prev.task || s.faults !== prev.faults
    if (!changed) return
    clearTimeout(timer)
    timer = setTimeout(() => void useLabStore.getState().persist(), AUTOSAVE_MS)
  })
  // IndexedDB writes are async, so flush as soon as the page is hidden rather than on unload.
  const flush = () => {
    if (document.visibilityState === 'hidden' && !useLabStore.getState().saved) {
      clearTimeout(timer)
      void useLabStore.getState().persist()
    }
  }
  document.addEventListener('visibilitychange', flush)
  return () => {
    clearTimeout(timer)
    unsub()
    document.removeEventListener('visibilitychange', flush)
  }
}

/** Warn when another tab changes the project open here. */
export function watchOtherTabs() {
  return subscribeToOtherTabs((e) => {
    const id = useLabStore.getState().projectId
    if (!id || e.id !== id) return
    if (e.type === 'deleted') toast.warning(t('This project was deleted in another tab. Saving here will recreate it.'), { id: 'other-tab' })
    else if (e.updatedAt !== lastWritten.get(id)) toast.warning(t('This project was changed in another tab. Saving here will overwrite those changes.'), { id: 'other-tab' })
  })
}
