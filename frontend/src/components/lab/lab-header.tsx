import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { btnGhost, btnOutline, btnPrimary, dialogSurface } from '@/components/app/styles'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { taskById } from '@/content/tasks'
import { href, navigateUnguarded, parseHash, setLeaveGuard } from '@/lib/router'
import { isStorageAvailable } from '@/storage/repository'
import { useLabStore } from '@/store/lab-store'

import { Brand, SaveButton, ThemeButton } from './top-bar'
import { t } from '@/i18n'

function useSaveLabel() {
  const saved = useLabStore((s) => s.saved)
  const savedAt = useLabStore((s) => s.savedAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(iv)
  }, [])
  if (!isStorageAvailable()) return t('Not saved · storage unavailable')
  if (!saved) return t('Unsaved changes')
  const mins = Math.round((Math.max(now, savedAt) - savedAt) / 60000)
  return mins < 1 ? t('Saved just now') : t('Saved {mins} min ago', { mins })
}

/** Where Exit goes: back to the lesson or challenge for a task, otherwise My Projects. */
function exitTarget() {
  const task = useLabStore.getState().task
  const def = task ? taskById(task.id) : undefined
  if (def?.kind === 'challenge') return href({ page: 'challenges', challengeId: def.id })
  if (def?.lessonId) return href({ page: 'learn', lessonId: def.lessonId })
  return href({ page: 'projects' })
}

/** Confirms every way out of the lab: the Exit button, links and the browser Back button. */
function ExitDialog({ to, onCancel }: { to: string; onCancel: () => void }) {
  const saved = useLabStore((s) => s.saved)
  const [busy, setBusy] = useState(false)
  // Saving failed (e.g. storage full): offer to leave anyway. The project stays open in memory.
  const [failed, setFailed] = useState(false)
  const storage = isStorageAvailable()

  const exit = async () => {
    if (storage && !useLabStore.getState().saved && !failed) {
      setBusy(true)
      const ok = await useLabStore.getState().persist({ manual: true })
      setBusy(false)
      if (!ok) {
        setFailed(true)
        toast.error(t('The project could not be saved, so you are still in the lab.'))
        return
      }
    }
    navigateUnguarded(to)
  }

  const message = !storage
    ? t('Browser storage is unavailable, so your changes are not saved. They will be lost when you close this tab.')
    : failed
      ? t('The project could not be saved. You can export it from the toolbar first, or leave without saving: it stays open in this tab until you open another project.')
      : saved
      ? t('Your project is saved. You can open it again from My Projects.')
      : t('Some changes might not be saved yet. They will be saved before you leave.')

  return (
    <AlertDialog open onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className={dialogSurface}>
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-base font-strong">{t('Do you really want to exit the Virtual Lab?')}</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-muted-foreground">{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-5 -mb-5 rounded-none border-t border-rule bg-transparent p-4">
          <AlertDialogCancel className={btnGhost}>{t('Stay in the lab')}</AlertDialogCancel>
          <Button className={btnPrimary} disabled={busy} onClick={() => void exit()}>
            {t(failed ? 'Exit without saving' : storage && !saved ? 'Save and exit' : 'Exit')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function LabHeader() {
  const projectName = useLabStore((s) => s.projectName)
  const saved = useLabStore((s) => s.saved)
  const saveLabel = useSaveLabel()
  const [leaveTo, setLeaveTo] = useState<string | null>(null)

  // Any hash change away from the lab asks first.
  useEffect(
    () =>
      setLeaveGuard((to) => {
        if (parseHash(to).page === 'lab') return true
        setLeaveTo(to)
        return false
      }),
    [],
  )

  // Closing or reloading the tab with unsaved changes gets the browser's own prompt.
  useEffect(() => {
    if (saved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saved])

  return (
    <header className="flex h-12 flex-none min-w-0 items-stretch edge-b">
      <div className="flex w-[248px] flex-none items-center gap-2.5 edge-r px-4">
        <Brand />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-4">
        <div className="truncate font-strong">{projectName}</div>
        <div className="text-[11px] text-muted-foreground">{saveLabel}</div>
      </div>
      <div className="flex items-center gap-3 edge-l px-4">
        <SaveButton />
        <ThemeButton />
        <Button variant="outline" className={btnOutline} onClick={() => setLeaveTo(exitTarget())}>
          {t('Exit lab')}
        </Button>
      </div>
      {leaveTo && <ExitDialog to={leaveTo} onCancel={() => setLeaveTo(null)} />}
    </header>
  )
}
