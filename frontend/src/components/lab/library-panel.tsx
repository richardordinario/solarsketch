import { useMemo, useState, type ReactNode } from 'react'
import { PlusIcon } from 'lucide-react'

import { AddDeviceDialog } from '@/components/app/add-device-dialog'
import { ComponentMenu } from '@/components/app/component-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { taskById } from '@/content/tasks'
import { CATALOG, CATEGORY_ORDER, makeNode } from '@/engine/catalog'
import { subText } from '@/engine/geometry'
import { componentImage } from '@/engine/component-images'
import { hasDevicePhoto } from '@/engine/device-images'
import { deviceProfiles, makeDeviceNode, type EquipmentProfile } from '@/engine/profiles'
import type { ComponentType } from '@/engine/types'
import { useDrawerContent } from '@/hooks/use-drawer-content'
import { cn } from '@/lib/utils'
import { useCatalogStore } from '@/store/catalog-store'
import { useLabStore } from '@/store/lab-store'

import { ComponentThumb, DeviceThumb } from './device-photo'
import { CollapsedRail, PanelToggle } from './shared'
import { DRAWER_W } from './drawers'
import { t } from '@/i18n'

export const DRAG_MIME = 'text/plain'

/** Drag payload: the component type, plus the device profile id for a real device. */
export const dragPayload = (type: ComponentType, profileId?: string) => (profileId ? `${type}|${profileId}` : type)
export function parseDragPayload(data: string): { type: ComponentType; profileId?: string } | null {
  const [type, profileId] = data.split('|')
  return type in CATALOG ? { type: type as ComponentType, profileId: profileId || undefined } : null
}

type Tab = 'generic' | 'devices'

const TYPES = Object.keys(CATALOG) as ComponentType[]
const PREVIEW_SUB = Object.fromEntries(TYPES.map((k) => [k, subText(makeNode(k, 0, 0, '_'))])) as Record<ComponentType, string>

export function LibraryPanel() {
  const query = useLabStore((s) => s.query)
  const setQuery = useLabStore((s) => s.setQuery)
  const addAtCenter = useLabStore((s) => s.addAtCenter)
  const open = useLabStore((s) => s.libraryOpen)
  const toggle = useLabStore((s) => s.toggleLibrary)
  const shown = useDrawerContent(open)
  const taskId = useLabStore((s) => s.task?.id)
  const allowed = taskId ? taskById(taskId)?.allowed : undefined
  const [tab, setTab] = useState<Tab>('generic')
  const [adding, setAdding] = useState(false)
  // Imported catalogs add devices, so re-derive the list when they change.
  const catalogs = useCatalogStore((s) => s.catalogs)
  const devices = useMemo(() => deviceProfiles().map((p) => ({ p, sub: subText(makeDeviceNode(p, 0, 0)) })), [catalogs]) // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase()
  const library = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: TYPES.filter((k) => CATALOG[k].cat === cat && (!allowed || allowed.includes(k)) && (!q || `${CATALOG[k].name} ${CATALOG[k].model} ${cat}`.toLowerCase().includes(q))),
  })).filter((g) => g.items.length)
  const deviceGroups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: devices.filter(({ p }) => CATALOG[p.type].cat === cat && (!allowed || allowed.includes(p.type)) && (!q || `${p.brand} ${p.model} ${CATALOG[p.type].name} ${cat}`.toLowerCase().includes(q))),
  })).filter((g) => g.items.length)
  const count = tab === 'generic' ? library.reduce((a, g) => a + g.items.length, 0) : deviceGroups.reduce((a, g) => a + g.items.length, 0)

  if (!shown) return <CollapsedRail side="left" label={t('Component Library')} onExpand={toggle} />

  return (
    <aside className="relative z-[1] flex min-h-0 flex-none flex-col edge-r bg-background text-[12px]" style={{ width: DRAWER_W.library }}>
      <div className="flex items-center gap-2 pt-1 pr-1 pb-0.5 pl-3">
        <div className="text-[13px] font-strong">{t('Component Library')}</div>
        <div className="ml-auto text-[10px] text-muted-foreground tabular-nums">{t('{n} items', { n: count })}</div>
        <Button
          variant="ghost"
          onClick={() => setAdding(true)}
          title={t('Add your own component')}
          aria-label={t('Add your own component')}
          className="h-8 w-8 flex-none p-0 text-dim hover:bg-muted hover:text-foreground active:translate-y-0 dark:hover:bg-muted"
        >
          <PlusIcon />
        </Button>
        <PanelToggle side="left" open label={t('Component Library')} onClick={toggle} />
        <AddDeviceDialog
          open={adding}
          onOpenChange={setAdding}
          onAdded={() => {
            setQuery('')
            setTab('devices')
          }}
        />
      </div>
      <div className="edge-b px-3 pb-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Search components')}
          aria-label={t('Search components')}
          className="h-7 border-(length:--bw) border-border bg-field px-2 text-[12px] select-text focus-visible:ring-0 md:text-[12px] dark:bg-field"
        />
        <div className="mt-2 flex h-7 edge" role="tablist" aria-label={t('Component Library')}>
          {(
            [
              ['generic', t('Generic')],
              ['devices', t('Real devices')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn('flex-1 cursor-pointer border-0 text-[11px] font-semibold', tab === k ? 'bg-secondary text-secondary-foreground' : 'bg-transparent text-dim hover:bg-muted')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'devices' && <DeviceList groups={deviceGroups} onAdd={(p) => addAtCenter(p.type, p.id)} />}
        {tab === 'generic' && library.map((g) => (
          <div key={g.cat}>
            <div className="px-3 pt-2.5 pb-1 text-[9.5px] font-strong tracking-[.08em] text-muted-foreground uppercase">{g.cat}</div>
            <CardGrid>
              {g.items.map((k) => (
                <LibraryCard
                  key={k}
                  type={k}
                  payload={dragPayload(k)}
                  onAdd={() => addAtCenter(k)}
                  title={t('Drag onto the canvas, or double-click to add. Right-click for price, tutorials and more.')}
                  media={componentImage(k) ? <ComponentThumb type={k} className="h-full w-full" /> : <CodeBadge code={CATALOG[k].code} />}
                  name={CATALOG[k].name}
                  sub={PREVIEW_SUB[k]}
                />
              ))}
            </CardGrid>
          </div>
        ))}
        {tab === 'generic' && !library.length && <div className="p-3 text-muted-foreground">{t('No components match “{q}”.', { q: query })}</div>}
        {allowed && <div className="px-3 py-2 text-[10px] text-pretty text-muted-foreground">{t('This task limits the library to the components it needs. Exit the task to use the full catalog.')}</div>}
      </div>

      <div className="edge-t px-3 py-2 text-[10px] text-pretty text-muted-foreground">
        {t('Drag a component onto the canvas. Drag from one terminal to another to draw a wire.')}
      </div>
    </aside>
  )
}

function DeviceList({ groups, onAdd }: { groups: { cat: string; items: { p: EquipmentProfile; sub: string }[] }[]; onAdd: (p: EquipmentProfile) => void }) {
  const query = useLabStore((s) => s.query)
  return (
    <>
      {groups.map((g) => (
        <div key={g.cat}>
          <div className="px-3 pt-2.5 pb-1 text-[9.5px] font-strong tracking-[.08em] text-muted-foreground uppercase">{g.cat}</div>
          <CardGrid>
            {g.items.map(({ p, sub }) => (
              <LibraryCard
                key={p.id}
                type={p.type}
                profile={p}
                payload={dragPayload(p.type, p.id)}
                onAdd={() => onAdd(p)}
                title={`${p.brand} ${p.model} · ${CATALOG[p.type].name}\n${t('Drag onto the canvas, or double-click to add. Right-click for price, tutorials and more.')}`}
                media={hasDevicePhoto(p.id) ? <DeviceThumb profileId={p.id} className="h-full w-full" /> : <CodeBadge code={CATALOG[p.type].code} />}
                name={p.model}
                sub={`${p.brand} · ${sub}`}
              />
            ))}
          </CardGrid>
        </div>
      ))}
      {!groups.length && <div className="p-3 text-muted-foreground">{query.trim() ? t('No components match “{q}”.', { q: query }) : t('No real devices for these components.')}</div>}
      <div className="px-3 py-2 text-[10px] text-pretty text-muted-foreground">
        {t('Values come from manufacturer datasheets and have not yet been reviewed. Check the datasheet in the inspector before relying on them. Import more devices on the Components page.')}
      </div>
    </>
  )
}

const CardGrid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-1.5 px-3 pb-1">{children}</div>

const CodeBadge = ({ code }: { code: string }) => <span className="text-[13px] font-strong tracking-[.04em] text-dim">{code}</span>

/** One draggable library item, laid out as a card: preview on top, name and key ratings below. Right-click opens `ComponentMenu`. */
function LibraryCard({
  type,
  profile,
  payload,
  onAdd,
  title,
  media,
  name,
  sub,
}: {
  type: ComponentType
  profile?: EquipmentProfile
  payload: string
  onAdd: () => void
  title: string
  media: ReactNode
  name: string
  sub: string
}) {
  return (
    <ComponentMenu
      type={type}
      profile={profile}
      sub={sub}
      onAdd={onAdd}
      render={
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, payload)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onDoubleClick={onAdd}
          title={title}
          className="flex min-w-0 cursor-grab flex-col edge bg-card hover:bg-muted active:cursor-grabbing"
        >
          <div className="flex h-12 items-center justify-center edge-b bg-canvas">{media}</div>
          <div className="min-w-0 px-2 py-1.5">
            <div className="line-clamp-2 leading-tight font-semibold wrap-anywhere">{name}</div>
            <div className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">{sub}</div>
          </div>
        </div>
      }
    />
  )
}
