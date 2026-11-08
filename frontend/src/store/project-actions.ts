import { toast } from 'sonner'

import type { Task } from '@/content/tasks'
import { SAMPLE_PROJECT_NAME, TEMPLATES, sampleProject } from '@/engine/sample-project'
import { navigate } from '@/lib/router'
import { createProjectDocument, isStorageAvailable, loadProject, saveProject } from '@/storage/repository'
import type { ProjectDocument } from '@/storage/schema'

import { useLabStore } from './lab-store'
import { useLoaderStore, withLoader } from './loader-store'
import { reportWriteError } from './storage-toast'
import { t } from '@/i18n'

/** Save the open project before switching, so nothing is lost. */
async function flushCurrent() {
  if (!useLabStore.getState().saved) await useLabStore.getState().persist()
}

async function load(doc: ProjectDocument, persist: boolean) {
  await flushCurrent()
  if (persist && isStorageAvailable()) {
    try {
      await saveProject(doc)
    } catch (e) {
      reportWriteError(e, t('The project could not be saved.'), 'save-failed')
    }
  }
  useLabStore.getState().loadDocument(doc)
  navigate({ page: 'lab' })
}

function openDocument(doc: ProjectDocument, { persist }: { persist: boolean }) {
  return withLoader(t('Opening {name}…', { name: doc.name }), () => load(doc, persist))
}

export function openProject(id: string) {
  return withLoader(t('Opening project…'), async () => {
    const doc = await loadProject(id)
    if (!doc) {
      toast.error(t('This project could not be opened. Its saved data may be damaged.'))
      return
    }
    useLoaderStore.setState({ label: t('Opening {name}…', { name: doc.name }) })
    await load(doc, false)
  })
}

export function newProject(kind: 'blank' | 'sample') {
  const doc =
    kind === 'sample' ? createProjectDocument({ name: SAMPLE_PROJECT_NAME, ...sampleProject() }) : createProjectDocument({ name: 'Untitled project', nodes: [], wires: [] })
  return openDocument(doc, { persist: true })
}

/** Starts a new project from a system template (off-grid, grid-tied, hybrid). */
export function newFromTemplate(id: string) {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0]
  return openDocument(createProjectDocument({ name: t.name, ...t.build() }), { persist: true })
}

/** Opens a lesson practice or challenge as a new project built from its starter. */
export function startTask(task: Task) {
  const label = task.kind === 'challenge' ? 'Challenge' : 'Practice'
  const doc = createProjectDocument({ name: `${label} · ${task.title}`, ...task.starter(), task: { kind: task.kind, id: task.id } })
  return openDocument(doc, { persist: true })
}

/** Imported or duplicated documents are already saved; just open them. */
export function openSavedDocument(doc: ProjectDocument) {
  return openDocument(doc, { persist: false })
}
