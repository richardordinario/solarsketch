import { useEffect, useRef, useState } from 'react'
import { CopyIcon, DownloadIcon, EllipsisIcon, FolderOpenIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Chip, Notice, Page, RowList } from '@/components/app/page'
import { btnGhost, btnOutline, btnPrimary, dialogSurface } from '@/components/app/styles'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TEMPLATES } from '@/engine/sample-project'
import { Input } from '@/components/ui/input'
import { taskById } from '@/content/tasks'
import { cn } from '@/lib/utils'
import {
  FILE_EXTENSION,
  ImportError,
  StorageFullError,
  deleteProject,
  downloadProject,
  duplicateProject,
  importProjectFile,
  isStorageAvailable,
  listProjects,
  loadProject,
  removeCorrupted,
  renameProject,
  type ProjectListing,
} from '@/storage/repository'
import type { ProjectSummary } from '@/storage/schema'
import { useLabStore } from '@/store/lab-store'
import { newFromTemplate, newProject, openProject, openSavedDocument } from '@/store/project-actions'
import { notifyStorageFull } from '@/store/storage-toast'
import { t } from '@/i18n'

function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{mins} min ago', { mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t('{hours} h ago', { hours })
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function ProjectRow({ p, current, onChanged, onDelete }: { p: ProjectSummary; current: boolean; onChanged: () => void; onDelete: (p: ProjectSummary) => void }) {
  const [editing, setEditing] = useState(false)
  const renaming = useRef(false)
  const [name, setName] = useState(p.name)
  const renameCurrent = useLabStore((s) => s.renameProject)
  const task = p.task ? taskById(p.task.id) : undefined

  const guard = (fn: () => Promise<void>) => () =>
    void fn().catch((e) => {
      if (e instanceof StorageFullError) notifyStorageFull()
      else toast.error(t('That action failed.'))
    })

  const commit = guard(async () => {
    setEditing(false)
    const n = name.trim()
    if (!n || n === p.name) return setName(p.name)
    // The open project lives in the store; rename it there and save, so autosave keeps the new name.
    if (current) {
      renameCurrent(n)
      await useLabStore.getState().persist()
    } else await renameProject(p.id, n)
    onChanged()
  })

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            aria-label={t('Project name')}
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setName(p.name)
                setEditing(false)
              }
            }}
            className="h-8 max-w-[420px] border-(length:--bw) border-border bg-field px-2 text-[14px] font-strong focus-visible:ring-0 md:text-[14px] dark:bg-field"
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => openProject(p.id)} className="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[14px] font-strong hover:underline">
              {p.name}
            </button>
            {current && <Chip tone="primary">{t('Open')}</Chip>}
            {task && <Chip>{t(task.kind === 'challenge' ? 'Challenge' : 'Practice')}</Chip>}
          </div>
        )}
        <div className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
          {t('{c} components · {w} wires · updated {when}', { c: p.components, w: p.wires, when: relativeTime(p.updatedAt) })}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" aria-label={t('Actions for “{name}”', { name: p.name })} className={cn(btnOutline, 'size-8 p-0')} />}
        >
          <EllipsisIcon className="size-4" />
        </DropdownMenuTrigger>
        {/* Renaming focuses the name field, so don't hand focus back to this button when the menu closes. */}
        <DropdownMenuContent align="end" className="w-44 rounded-none ring-border" finalFocus={() => {
            const toName = renaming.current
            renaming.current = false
            return !toName
          }}
        >
          <DropdownMenuItem onClick={() => void openProject(p.id)}>
            <FolderOpenIcon />
            {t('Open')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              renaming.current = true
              setEditing(true)
            }}
          >
            <PencilIcon />
            {t('Rename')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={guard(async () => {
              if (current) await useLabStore.getState().persist()
              await duplicateProject(p.id)
              onChanged()
              toast.success(t('Duplicated “{name}”.', { name: p.name }))
            })}
          >
            <CopyIcon />
            {t('Duplicate')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={guard(async () => {
              if (current) await useLabStore.getState().persist()
              const doc = await loadProject(p.id)
              if (doc) downloadProject(doc)
            })}
          >
            <DownloadIcon />
            {t('Export')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(p)}>
            <Trash2Icon />
            {t('Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function ProjectsPage() {
  const [version, setVersion] = useState(0)
  const [listing, setListing] = useState<ProjectListing | null>(null)
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const currentId = useLabStore((s) => s.projectId)
  // Re-list after each autosave of the open project, and after actions on this page.
  const savedAt = useLabStore((s) => s.savedAt)
  const refresh = () => setVersion((v) => v + 1)

  useEffect(() => {
    let cancelled = false
    listProjects().then((l) => !cancelled && setListing(l))
    return () => {
      cancelled = true
    }
  }, [version, savedAt])

  const available = isStorageAvailable()
  const projects = listing?.projects ?? []
  const corrupted = listing?.corrupted ?? []

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const doc = await importProjectFile(file)
      toast.success(t('Imported “{name}”.', { name: doc.name }))
      await openSavedDocument(doc)
    } catch (e) {
      if (e instanceof StorageFullError) notifyStorageFull()
      else toast.error(e instanceof ImportError ? e.message : t('The file could not be imported.'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Page
      title={t('My Projects')}
      description={t('Projects are stored in this browser’s local storage. There is no account and nothing is uploaded.')}
      actions={
        <>
          <input ref={fileRef} type="file" accept={`${FILE_EXTENSION},.json,application/json`} className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
          <Button variant="outline" className={btnOutline} onClick={() => fileRef.current?.click()} disabled={!available}>
            {t('Import project')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className={btnOutline} />}>{t('New from template')}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-none ring-border">
              {TEMPLATES.map((tpl) => (
                <DropdownMenuItem key={tpl.id} className="flex-col items-start gap-0.5 py-2" onClick={() => void newFromTemplate(tpl.id)}>
                  <span className="text-[13px] font-strong">{tpl.name}</span>
                  <span className="text-[12px] text-pretty text-muted-foreground">{tpl.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className={btnPrimary} onClick={() => newProject('blank')}>
            {t('New blank project')}
          </Button>
        </>
      }
    >
      {!available ? (
        <Notice tone="warning">
          {t('Browser storage is unavailable (for example in some private windows), so projects cannot be saved here. Your open project works for this session only.')}
        </Notice>
      ) : (
        <Notice>
          {t('Clearing this browser’s site data deletes these projects, and they do not sync to other devices. Use Export to keep a {ext} backup or to hand work to an instructor.', { ext: FILE_EXTENSION })}
        </Notice>
      )}

      {corrupted.length > 0 && (
        <Notice tone="warning">
          {t(corrupted.length > 1 ? '{n} saved projects are damaged and cannot be opened.' : '{n} saved project is damaged and cannot be opened.', { n: corrupted.length })}{' '}
          <button
            className="cursor-pointer border-0 bg-transparent p-0 font-strong underline"
            onClick={() => void removeCorrupted(corrupted).then(refresh)}
          >
            {t(corrupted.length > 1 ? 'Remove them' : 'Remove it')}
          </button>
        </Notice>
      )}

      {!listing ? null : projects.length ? (
        <RowList>
          {projects.map((p) => (
            <ProjectRow key={p.id + p.name} p={p} current={p.id === currentId} onChanged={refresh} onDelete={setToDelete} />
          ))}
        </RowList>
      ) : (
        <div className="border-2 border-dashed border-subtle px-6 py-8 text-center text-muted-foreground">
          <div className="mb-1 font-strong text-foreground">{t('No saved projects yet')}</div>
          {t('Start a new project, or import a {ext} file.', { ext: FILE_EXTENSION })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className={dialogSurface}>
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogTitle className="text-base font-strong">{t('Delete “{name}”?', { name: toDelete?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">{t('This removes the project from this browser. It cannot be undone unless you exported a copy.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-5 -mb-5 rounded-none border-t border-rule bg-transparent p-4">
            <AlertDialogCancel className={btnGhost}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={btnPrimary}
              onClick={async () => {
                if (!toDelete) return
                const target = toDelete
                const wasOpen = target.id === currentId
                setToDelete(null)
                // Stop autosave from recreating the open project after it is deleted.
                if (wasOpen) useLabStore.setState({ saved: true })
                await deleteProject(target.id)
                toast.success(t('Deleted “{name}”.', { name: target.name }))
                if (wasOpen) {
                  const next = (await listProjects()).projects[0]
                  const doc = next ? await loadProject(next.id) : null
                  if (doc) useLabStore.getState().loadDocument(doc)
                  else await newProject('sample')
                }
                refresh()
              }}
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
