import type { ReactElement, ReactNode } from 'react'
import { BookOpenIcon, CirclePlayIcon, FileTextIcon, PlusIcon, ShieldCheckIcon, TagIcon, WaypointsIcon } from 'lucide-react'

import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { CATALOG } from '@/engine/catalog'
import type { EquipmentProfile } from '@/engine/profiles'
import type { ComponentType } from '@/engine/types'
import { t } from '@/i18n'
import { openExternal, searchTerm, webLink, type WebLink } from '@/lib/web-search'

const ITEM = 'rounded-none text-[12.5px]'

/**
 * Right-click menu for a library card: web searches (price, tutorials, datasheet, wiring diagrams,
 * safety) that open in a new tab, plus Add to canvas and the Component Library reference.
 * `render` is the card element itself, which becomes the menu trigger; or pass `children` (for
 * cards that don't forward props) and they are wrapped in a `display: contents` trigger.
 */
export function ComponentMenu({
  type,
  profile,
  sub,
  onAdd,
  libraryLink = true,
  render,
  children,
}: {
  type: ComponentType
  profile?: EquipmentProfile
  /** The card's ratings line; its first part sharpens the search for generic components. */
  sub?: string
  onAdd?: () => void
  /** Show "View in Component Library" (off on the Components page itself). */
  libraryLink?: boolean
  render?: ReactElement
  children?: ReactNode
}) {
  const term = searchTerm(type, profile, sub)
  const go = (kind: WebLink) => () => openExternal(webLink(kind, type, term))
  const source = profile?.source
  const datasheet = source ? () => openExternal(source.url) : go('datasheet')

  return (
    <ContextMenu>
      {render ? <ContextMenuTrigger render={render} /> : <ContextMenuTrigger className="contents select-auto">{children}</ContextMenuTrigger>}
      <ContextMenuContent className="min-w-56 rounded-none ring-border">
        <ContextMenuGroup>
          <ContextMenuLabel className="truncate font-semibold text-foreground">{profile ? `${profile.brand} ${profile.model}` : CATALOG[type].name}</ContextMenuLabel>
        </ContextMenuGroup>
        <ContextMenuItem className={ITEM} onClick={go('price')}>
          <TagIcon />
          {t('Search price')}
        </ContextMenuItem>
        <ContextMenuItem className={ITEM} onClick={go('howto')}>
          <CirclePlayIcon />
          {t('How to use (video tutorials)')}
        </ContextMenuItem>
        <ContextMenuItem className={ITEM} onClick={datasheet}>
          <FileTextIcon />
          {source ? t('Open datasheet') : t('Find datasheet and specs')}
        </ContextMenuItem>
        <ContextMenuItem className={ITEM} onClick={go('diagram')}>
          <WaypointsIcon />
          {t('Wiring diagram examples')}
        </ContextMenuItem>
        <ContextMenuItem className={ITEM} onClick={go('safety')}>
          <ShieldCheckIcon />
          {t('Safety tips')}
        </ContextMenuItem>
        {(onAdd || libraryLink) && <ContextMenuSeparator />}
        {onAdd && (
          <ContextMenuItem className={ITEM} onClick={onAdd}>
            <PlusIcon />
            {t('Add to canvas')}
          </ContextMenuItem>
        )}
        {libraryLink && (
          <ContextMenuItem className={ITEM} onClick={() => openExternal(`${location.pathname}${location.search}#/components/${type}`)}>
            <BookOpenIcon />
            {t('View in Component Library')}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <div className="max-w-60 px-1.5 py-1 text-[10px] text-pretty text-muted-foreground">
          {t('Web searches open in a new tab. Prices and tutorials come from other sites and are not checked by SolarSketch.')}
        </div>
      </ContextMenuContent>
    </ContextMenu>
  )
}
