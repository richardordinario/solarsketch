import { toast } from 'sonner'

import { href, navigate } from '@/lib/router'
import { StorageFullError, downloadProject } from '@/storage/repository'
import { t } from '@/i18n'

import { useLabStore } from './lab-store'

/**
 * Storage is full (PRD §11.3): keep the in-memory project, tell the user, and offer the two ways
 * out: download the open project as a file, or go to My Projects to delete old ones.
 * One toast at a time (fixed id), however many writes fail.
 */
export function notifyStorageFull() {
  const doc = useLabStore.getState().toDocument()
  toast.error(t('Browser storage is full, so your work is not being saved. Export the open project, then delete old projects to free space.'), {
    id: 'storage-full',
    duration: 20000,
    action: doc
      ? {
          label: t('Export project'),
          onClick: () => {
            const current = useLabStore.getState().toDocument()
            if (current) downloadProject(current)
          },
        }
      : undefined,
    cancel: {
      label: t('My Projects'),
      // From the lab this goes through the exit confirmation, which offers to leave without saving.
      onClick: () => {
        if (window.location.hash !== href({ page: 'projects' })) navigate({ page: 'projects' })
      },
    },
  })
}

/** Report a failed background write once per kind; storage-full gets the actions above. */
export function reportWriteError(e: unknown, fallback: string, id: string) {
  if (e instanceof StorageFullError) notifyStorageFull()
  else toast.error(fallback, { id })
}
