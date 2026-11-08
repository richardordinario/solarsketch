import { useEffect, useState } from 'react'

import { CatalogSection } from '@/components/app/catalog-section'
import { ComponentMenu } from '@/components/app/component-menu'
import { Page, PageSection, RowList } from '@/components/app/page'
import { SEV_COLOR, SEV_LABEL } from '@/components/lab/severity'
import { SevIcon } from '@/components/lab/sev-icon'
import { TERMINAL_COLOR } from '@/components/lab/colors'
import { ComponentCredit, ComponentThumb, DeviceThumb } from '@/components/lab/device-photo'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CATALOG, CATEGORY_ORDER, DOMAIN_LABEL, RULESET_VERSION } from '@/engine/catalog'
import { componentImage } from '@/engine/component-images'
import { deviceImage } from '@/engine/device-images'
import { PROFILES, type EquipmentProfile } from '@/engine/profiles'
import { RULES } from '@/engine/rules'
import type { ComponentType } from '@/engine/types'
import { t } from '@/i18n'

const TYPES = Object.keys(CATALOG) as ComponentType[]

/** DOM id of a component's card, the target of `#/components/<type>` deep links. */
const cardId = (type: string) => `component-${type}`

function ComponentCard({ type, highlight }: { type: ComponentType; highlight?: boolean }) {
  const c = CATALOG[type]
  const terms = c.L.concat(c.R)
  const img = componentImage(type)
  return (
    <div
      id={cardId(type)}
      tabIndex={-1}
      aria-current={highlight ? 'true' : undefined}
      className={cn('flex min-w-0 scroll-mt-4 flex-col edge bg-card outline-none', highlight && 'shadow-[0_0_0_3px_var(--primary)]')}
    >
      {img && (
        <div className="flex h-40 items-center justify-center border-b border-rule bg-white">
          <ComponentThumb type={type} className="h-full w-full p-2" />
        </div>
      )}
      <div className="flex items-center gap-3 border-b border-rule px-3 py-2.5">
        <div className="flex h-9 w-12 flex-none items-center justify-center bg-secondary text-[11px] font-strong text-secondary-foreground">{c.code}</div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-strong">{c.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.model} · spec v{c.ver}
          </div>
        </div>
      </div>
      <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2 text-[12px]">
        {c.specs.map(([key, label, unit, value]) => (
          <div key={key} className="contents">
            <dt className="truncate text-muted-foreground">{label}</dt>
            <dd className="m-0 text-right font-semibold tabular-nums">
              {value} {unit}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t border-rule px-3 py-2 text-[11px]">
        {terms.length ? (
          terms.map(([tid, label, t]) => (
            <span key={tid} className="inline-flex items-center gap-1.5" title={DOMAIN_LABEL[t]}>
              <span className="size-2.5" style={{ border: `2px solid ${TERMINAL_COLOR[t]}` }} />
              <span className="font-semibold">{label}</span>
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">{t('No terminals')}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 border-t border-rule px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>{c.doc}</span>
        <ComponentCredit type={type} />
      </div>
    </div>
  )
}

const DEVICES = PROFILES.filter((p) => !p.example)
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')

function DeviceCard({ p }: { p: EquipmentProfile }) {
  const c = CATALOG[p.type]
  const img = deviceImage(p.id)
  return (
    <div className="flex min-w-0 flex-col edge bg-card">
      <div className="flex h-40 items-center justify-center border-b border-rule bg-white">
        {img ? <DeviceThumb profileId={p.id} className="h-full w-full p-2" /> : <span className="text-[13px] font-strong text-dim">{c.code}</span>}
      </div>
      <div className="border-b border-rule px-3 py-2.5">
        <div className="truncate text-[14px] font-strong" title={p.model}>
          {p.model}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {p.brand} · {c.name}
        </div>
      </div>
      <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2 text-[12px]">
        {c.specs.map(([key, label, unit]) => (
          <div key={key} className="contents">
            <dt className="truncate text-muted-foreground">
              {t(label)}
              {p.settings?.includes(key) ? ' *' : ''}
            </dt>
            <dd className="m-0 text-right font-semibold tabular-nums">{p.missing?.includes(key) ? '—' : `${p.specs[key]} ${unit}`}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-rule px-3 py-1.5 text-[11px] text-muted-foreground">
        {p.source && (
          <a href={p.source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">
            {t('Open datasheet')}
          </a>
        )}
        {p.settings?.length ? <span>{t('* Installer setting, not a datasheet value.')}</span> : null}
        {img && (
          <span>
            {t(img.official ? 'Photo: manufacturer website' : 'Photo: reseller website')}
            {img.match === 'series' && ` · ${t('shows the product series')}`} ·{' '}
            <a href={img.sourcePage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {hostOf(img.sourcePage)}
            </a>
          </span>
        )}
      </div>
    </div>
  )
}

/** `type` comes from a `#/components/<type>` deep link (e.g. a lesson's hardware reference). */
export function ComponentsPage({ type }: { type?: string }) {
  const [query, setQuery] = useState('')
  const target = type && type in CATALOG ? (type as ComponentType) : undefined

  // Deep link: scroll to the card and move focus there. (App re-mounts this page per link, so no filter hides it.)
  useEffect(() => {
    if (!target) return
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(cardId(target))
      el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [target])

  const q = query.trim().toLowerCase()
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: TYPES.filter((k) => CATALOG[k].cat === cat && (!q || `${CATALOG[k].name} ${CATALOG[k].model} ${cat}`.toLowerCase().includes(q))),
  })).filter((g) => g.items.length)
  const deviceGroups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: DEVICES.filter((p) => CATALOG[p.type].cat === cat && (!q || `${p.brand} ${p.model} ${CATALOG[p.type].name} ${cat}`.toLowerCase().includes(q))),
  })).filter((g) => g.items.length)

  return (
    <Page
      wide
      title={t('Component Library')}
      description={t('Reference specifications and terminals for every component available in the Virtual Lab. Values are educational examples, not manufacturer data.')}
      actions={
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Search components')}
          aria-label={t('Search components')}
          className="h-8 w-[240px] border-(length:--bw) border-border bg-field px-2.5 text-[13px] focus-visible:ring-0 md:text-[13px] dark:bg-field"
        />
      }
    >
      {type && !target && <p className="text-muted-foreground">{t('The component “{q}” is not in this version of the library.', { q: type })}</p>}
      {groups.map((g) => (
        <PageSection key={g.cat} title={g.cat}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {g.items.map((k) => (
              <ComponentMenu key={k} type={k} libraryLink={false}>
                <ComponentCard type={k} highlight={k === target} />
              </ComponentMenu>
            ))}
          </div>
        </PageSection>
      ))}
      {!groups.length && !deviceGroups.length && <p className="text-muted-foreground">{t('No components match “{q}”.', { q: query })}</p>}

      {deviceGroups.length > 0 && (
        <PageSection title={t('Real devices')} aside={t('Values from manufacturer datasheets, not yet reviewed')}>
          {deviceGroups.map((g) => (
            <div key={g.cat} className="mb-5 last:mb-0">
              <div className="mb-2 text-[10px] font-strong tracking-[.08em] text-muted-foreground uppercase">{g.cat}</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
                {g.items.map((p) => (
                  <ComponentMenu key={p.id} type={p.type} profile={p} libraryLink={false}>
                    <DeviceCard p={p} />
                  </ComponentMenu>
                ))}
              </div>
            </div>
          ))}
        </PageSection>
      )}

      <CatalogSection />

      <PageSection title={`Safety rule library · v${RULESET_VERSION}`} aside={t('Educational rules, pending review by a qualified electrical engineer')}>
        <RowList>
          {Object.values(RULES)
            .filter((r) => !q || `${r.id} ${r.title} ${r.appliesTo}`.toLowerCase().includes(q))
            .map((r) => (
              <details key={r.id} className="group px-4 py-2">
                <summary className="grid cursor-pointer list-none grid-cols-[72px_96px_minmax(0,1fr)_minmax(0,200px)] items-baseline gap-3">
                  <span className="text-[12px] font-strong tabular-nums">{r.id}</span>
                  <span className="text-[11px] font-strong" style={{ color: SEV_COLOR[r.severity] }}>
                    <SevIcon sev={r.severity} /> {SEV_LABEL[r.severity]}
                  </span>
                  <span className="font-semibold">{r.title}</span>
                  <span className="truncate text-[12px] text-muted-foreground">{r.appliesTo}</span>
                </summary>
                <dl className="m-0 mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 pl-[84px] text-[12px]">
                  <dt className="text-muted-foreground">{t('Stage')}</dt>
                  <dd className="m-0">{r.stage}</dd>
                  <dt className="text-muted-foreground">{t('Detection')}</dt>
                  <dd className="m-0 text-pretty">{r.detection}</dd>
                  <dt className="text-muted-foreground">{t('Why it matters')}</dt>
                  <dd className="m-0 text-pretty">{r.explanation}</dd>
                  <dt className="text-muted-foreground">{t('Reference')}</dt>
                  <dd className="m-0 text-pretty">{r.reference}</dd>
                  <dt className="text-muted-foreground">{t('Version')}</dt>
                  <dd className="m-0">v{r.version}</dd>
                </dl>
              </details>
            ))}
        </RowList>
      </PageSection>
    </Page>
  )
}
