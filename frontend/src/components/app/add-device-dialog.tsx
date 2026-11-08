import { useRef, useState, type FormEvent } from 'react'
import { ImagePlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { btnGhost, btnPrimary, dialogSurface } from '@/components/app/styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATALOG, CATEGORY_ORDER, SWITCH_SPEC } from '@/engine/catalog'
import { CatalogImportError } from '@/engine/catalog-import'
import type { EquipmentProfile } from '@/engine/profiles'
import type { ComponentType } from '@/engine/types'
import { PhotoError, photoFromFile } from '@/lib/image'
import { cn } from '@/lib/utils'
import { StorageFullError, isStorageAvailable } from '@/storage/repository'
import { useCatalogStore } from '@/store/catalog-store'
import { t } from '@/i18n'

const TYPES = Object.keys(CATALOG) as ComponentType[]
const ITEMS = TYPES.map((k) => ({ value: k, label: CATALOG[k].name }))
const GROUPS = CATEGORY_ORDER.map((cat) => ({ cat, types: TYPES.filter((k) => CATALOG[k].cat === cat) })).filter((g) => g.types.length)

const field = 'h-8 rounded-none border-(length:--bw) border-border bg-field px-2 text-[13px] focus-visible:ring-0 md:text-[13px] dark:bg-field'
const labelCls = 'flex flex-col gap-1 text-[12px] font-semibold'

/** Specs the form asks for: everything except the on/off position of switches (set in the inspector). */
const formSpecs = (type: ComponentType) => CATALOG[type].specs.filter(([k]) => k !== SWITCH_SPEC)
const defaultsFor = (type: ComponentType) => Object.fromEntries(formSpecs(type).map(([k, , , v]) => [k, String(v)]))

/**
 * Add your own device (PRD P2 catalog import, as a form): pick the component type, enter brand,
 * model and the datasheet values. It is stored in the "My devices" catalog and works in the
 * simulation like any other device, because the engine already models its type.
 */
export function AddDeviceDialog({ open, onOpenChange, onAdded, initialType = 'pv' }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded?: (p: EquipmentProfile) => void; initialType?: ComponentType }) {
  const addDevice = useCatalogStore((s) => s.addDevice)
  const [type, setType] = useState<ComponentType>(initialType)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [specs, setSpecs] = useState<Record<string, string>>(() => defaultsFor(initialType))
  const [url, setUrl] = useState('')
  const [revision, setRevision] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const [photoError, setPhotoError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setType(initialType)
    setBrand('')
    setModel('')
    setSpecs(defaultsFor(initialType))
    setUrl('')
    setRevision('')
    setNotes('')
    setPhoto('')
    setPhotoError('')
    setError('')
  }

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError('')
    try {
      setPhoto(await photoFromFile(file))
    } catch (err) {
      setPhotoError(err instanceof PhotoError ? t(err.message) : t('This image could not be read.'))
    } finally {
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  const pickType = (k: ComponentType) => {
    setType(k)
    setSpecs(defaultsFor(k))
    setError('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const values: Record<string, number> = {}
    for (const [k, label] of formSpecs(type)) {
      const raw = (specs[k] ?? '').trim()
      const n = Number(raw)
      if (!raw || !Number.isFinite(n)) return setError(t('Enter a number for “{label}”.', { label: t(label) }))
      values[k] = n
    }
    // The switch position is not a datasheet value; new devices start closed.
    if (CATALOG[type].specs.some(([k]) => k === SWITCH_SPEC)) values[SWITCH_SPEC] = 1
    const link = url.trim()
    setBusy(true)
    try {
      const p = await addDevice({
        type,
        brand,
        model,
        specs: values,
        ...(link ? { datasheet: { url: link, revision: revision.trim() || 'Revision not stated' } } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(photo ? { photo } : {}),
      })
      toast.success(t('Added {name}. It is in the lab library under Real devices.', { name: `${p.brand} ${p.model}` }))
      onAdded?.(p)
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof CatalogImportError || err instanceof StorageFullError ? err.message : t('The component could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError('')
        onOpenChange(o)
      }}
    >
      <DialogContent className={cn(dialogSurface, 'max-h-[calc(100dvh-2rem)] gap-0 overflow-auto sm:max-w-[600px]')}>
        <DialogTitle className="m-0 text-base font-strong">{t('Add your own component')}</DialogTitle>
        <DialogDescription className="mt-1 text-[12px] text-pretty text-muted-foreground">
          {t('Copy the values from the manufacturer’s datasheet. The device is saved in this browser, works in the simulation like the built-in components, and is marked unreviewed: SolarSketch does not check the values.')}
        </DialogDescription>

        <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-3">
          <label className={labelCls}>
            {t('Component type')}
            <Select items={ITEMS} value={type} onValueChange={(v) => v && pickType(v as ComponentType)}>
              <SelectTrigger aria-label={t('Component type')} className={cn(field, 'w-full font-semibold dark:hover:bg-muted')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80 ring-border">
                {GROUPS.map((g) => (
                  <SelectGroup key={g.cat}>
                    <SelectLabel className="text-[10px] tracking-[.08em] uppercase">{g.cat}</SelectLabel>
                    {g.types.map((k) => (
                      <SelectItem key={k} value={k} className="text-[13px]">
                        {CATALOG[k].name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3">
            <div className="flex flex-col gap-1 text-[12px] font-semibold">
              <span>{t('Photo (optional)')}</span>
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  aria-label={photo ? t('Change photo') : t('Upload photo')}
                  title={photo ? t('Change photo') : t('Upload photo')}
                  className="flex size-[72px] cursor-pointer items-center justify-center overflow-hidden border-(length:--bw) border-dashed border-border bg-white p-0 text-dim hover:bg-muted"
                >
                  {photo ? <img src={photo} alt="" className="h-full w-full object-contain" /> : <ImagePlusIcon className="size-6" />}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    aria-label={t('Remove photo')}
                    title={t('Remove photo')}
                    className="absolute -top-2 -right-2 flex size-5 cursor-pointer items-center justify-center edge bg-background p-0 hover:bg-muted"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </div>
            </div>
            <label className={labelCls}>
              {t('Brand')}
              <Input required maxLength={60} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t('e.g. the manufacturer')} className={field} />
            </label>
            <label className={labelCls}>
              {t('Model')}
              <Input required maxLength={100} value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('Model number')} className={field} />
            </label>
          </div>

          {photoError ? (
            <p role="alert" className="-mt-1 mb-0 text-[11.5px] font-semibold text-(--critical)">
              {photoError}
            </p>
          ) : (
            <p className="-mt-1 mb-0 text-[11px] text-muted-foreground">{t('Use your own photo or one you may share. It is resized and saved in this browser with the device.')}</p>
          )}

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 text-[12px] font-strong">{t('Specifications')}</legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {formSpecs(type).map(([k, label, unit]) => (
                <label key={k} className="flex flex-col gap-1 text-[11.5px] text-muted-foreground">
                  <span className="truncate" title={t(label)}>
                    {t(label)}
                    {unit && ` (${unit})`}
                  </span>
                  <Input inputMode="decimal" value={specs[k] ?? ''} onChange={(e) => setSpecs((s) => ({ ...s, [k]: e.target.value }))} className={cn(field, 'text-foreground tabular-nums')} />
                </label>
              ))}
            </div>
            <p className="mt-1.5 mb-0 text-[11px] text-muted-foreground">{t('Fields start at the generic component’s example values. Replace each one with the datasheet value.')}</p>
          </fieldset>

          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
            <label className={labelCls}>
              {t('Datasheet link (recommended)')}
              <Input type="url" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={field} />
            </label>
            <label className={labelCls}>
              {t('Datasheet revision')}
              <Input maxLength={80} value={revision} onChange={(e) => setRevision(e.target.value)} placeholder={t('e.g. Rev. B')} disabled={!url.trim()} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t('Notes (optional)')}
            <Input maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </label>

          {error && (
            <p role="alert" className="m-0 text-[12px] font-semibold text-(--critical)">
              {error}
            </p>
          )}

          <div className="-mx-5 -mb-5 mt-1 flex justify-end gap-2 border-t border-rule p-4">
            <Button type="button" variant="ghost" className={btnGhost} onClick={() => onOpenChange(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" className={btnPrimary} disabled={busy || !isStorageAvailable()}>
              {t('Add component')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
