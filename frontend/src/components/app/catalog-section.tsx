import { useRef } from 'react'
import { toast } from 'sonner'

import { Notice, PageSection, RowList } from '@/components/app/page'
import { btnGhost, btnOutline } from '@/components/app/styles'
import { Button } from '@/components/ui/button'
import { CATALOG } from '@/engine/catalog'
import { CatalogImportError, MAX_CATALOG_BYTES, catalogTemplate } from '@/engine/catalog-import'
import { StorageFullError, downloadBlob, isStorageAvailable } from '@/storage/repository'
import { useCatalogStore } from '@/store/catalog-store'
import { t } from '@/i18n'

/** Import and manage equipment catalogs taken from real datasheets (PRD P2). */
export function CatalogSection() {
  const catalogs = useCatalogStore((s) => s.catalogs)
  const { importText, remove } = useCatalogStore.getState()
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      if (file.size > MAX_CATALOG_BYTES) throw new CatalogImportError(t('This catalog file is too large (limit 1 MB).'))
      const cat = await importText(await file.text())
      toast.success(t('Imported “{name}” with {n} profiles. They now appear in the inspector’s Equipment profile list.', { name: cat.name, n: cat.profiles.length }))
    } catch (e) {
      toast.error(e instanceof CatalogImportError || e instanceof StorageFullError ? e.message : t('The catalog could not be imported.'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <PageSection
      title={t('Equipment catalogs')}
      aside={
        <span className="flex gap-1">
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button variant="ghost" className={btnGhost} onClick={() => downloadBlob(new Blob([catalogTemplate()], { type: 'application/json' }), 'solarsketch-catalog-template.json')}>
            {t('Download template')}
          </Button>
          <Button variant="outline" className={btnOutline} disabled={!isStorageAvailable()} onClick={() => fileRef.current?.click()}>
            {t('Import catalog')}
          </Button>
        </span>
      }
    >
      <Notice>
        {t('Add equipment from real datasheets as a JSON catalog. Every specification for the component type is required, with a datasheet link and revision. Imported values are stored in this browser, are not verified by SolarSketch, and are marked unreviewed until someone checks them against the datasheet.')}
      </Notice>
      {catalogs.length ? (
        <RowList>
          {catalogs.map((c) => (
            <details key={c.id} className="px-4 py-2">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="font-strong">{c.name}</span>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {c.profiles.length} profile{c.profiles.length > 1 ? 's' : ''} · imported {new Date(c.importedAt).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  className={`${btnGhost} ml-auto h-7`}
                  onClick={(e) => {
                    e.preventDefault()
                    void remove(c.id).then(() => toast.success(t('Removed “{name}”. Components that used its profiles keep their values.', { name: c.name })))
                  }}
                >
                  Remove
                </Button>
              </summary>
              <div className="mt-2 grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
                {c.profiles.map((p) => (
                  <div key={p.id} className="contents">
                    <span className="text-muted-foreground">{CATALOG[p.type].name}</span>
                    <span className="font-semibold">
                      {p.brand} {p.model}
                    </span>
                    <a href={p.source?.url} target="_blank" rel="noreferrer noopener" className="truncate">
                      {p.source?.revision}
                    </a>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </RowList>
      ) : (
        <p className="m-0 text-muted-foreground">{t('No imported catalogs. Download the template to see the format.')}</p>
      )}
    </PageSection>
  )
}
