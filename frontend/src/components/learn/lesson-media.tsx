/**
 * Renders a lesson section's media blocks (PRD Module 1 lesson interface): illustrations,
 * interactive diagrams, hardware references, animated walkthroughs and local videos.
 */
import type { ReactNode } from 'react'

import { ComponentCredit, ComponentThumb } from '@/components/lab/device-photo'
import type { LessonMedia } from '@/content/lessons'
import { CATALOG } from '@/engine/catalog'
import { componentImage } from '@/engine/component-images'
import type { ComponentType } from '@/engine/types'
import { t } from '@/i18n'

import { ILLUSTRATIONS, WIDGETS, componentHref } from './registry'
import { WalkthroughPlayer } from './walkthroughs'

function Figure({ kind, caption, children }: { kind: string; caption?: string; children: ReactNode }) {
  return (
    <figure className="m-0 mb-4 max-w-[760px] edge bg-card">
      <div className="border-b border-rule px-4 py-1.5 text-[10px] font-strong tracking-[.08em] text-muted-foreground uppercase">{kind}</div>
      {children}
      {caption && <figcaption className="border-t border-rule px-4 py-2 text-[12px] text-pretty text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}

/** Catalog components mentioned in the lesson, with a thumbnail, its credit and a link to its card. */
function HardwareRefs({ types }: { types: ComponentType[] }) {
  const known = types.filter((type) => CATALOG[type])
  if (!known.length) return null
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] p-0">
      {known.map((type) => {
        const c = CATALOG[type]
        const img = componentImage(type)
        return (
          <li key={type} className="flex min-w-0 gap-3 border-r border-b border-rule px-3 py-2.5">
            {img ? (
              <ComponentThumb type={type} className="size-14 edge" />
            ) : (
              <span className="flex size-14 flex-none items-center justify-center bg-secondary text-[11px] font-strong text-secondary-foreground">{c.code}</span>
            )}
            <span className="flex min-w-0 flex-col">
              <a href={componentHref(type)} className="text-[13px] leading-snug font-strong">
                {c.name}
              </a>
              <span className="text-[11px] text-muted-foreground">
                {c.cat} · {c.model}
              </span>
              {img && (
                <span className="mt-0.5 text-[10px] leading-snug text-pretty text-muted-foreground">
                  <ComponentCredit type={type} />
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** A local video (never a third-party embed) with optional WebVTT captions, both under public/videos/. */
function LessonVideo({ src, title, captions, poster }: { src: string; title: string; captions?: string; poster?: string }) {
  const url = (file: string) => import.meta.env.BASE_URL + file.replace(/^\//, '')
  return (
    <video controls preload="metadata" className="block w-full bg-black" poster={poster ? url(poster) : undefined} aria-label={title}>
      <source src={url(src)} />
      {captions && <track kind="captions" src={url(captions)} srcLang="en" label="English" default />}
      {t('Your browser cannot play this video.')}
    </video>
  )
}

export function LessonMediaBlock({ media }: { media: LessonMedia }) {
  switch (media.kind) {
    case 'illustration': {
      const Illustration = ILLUSTRATIONS[media.id]
      return (
        <Figure kind={t('Illustration')} caption={media.caption}>
          <div className="px-4 py-3">
            <Illustration label={media.caption} />
          </div>
        </Figure>
      )
    }
    case 'interactive': {
      const Widget = WIDGETS[media.id]
      return (
        <Figure kind={t('Interactive diagram')} caption={media.caption}>
          <Widget />
        </Figure>
      )
    }
    case 'hardware':
      return (
        <Figure kind={t('Hardware reference')} caption={media.caption ?? t('Open a component to see its terminals, specifications and the rules that apply to it.')}>
          <HardwareRefs types={media.types} />
        </Figure>
      )
    case 'walkthrough':
      return (
        <Figure kind={t('Animated walkthrough')} caption={media.caption}>
          <WalkthroughPlayer id={media.id} />
        </Figure>
      )
    case 'video':
      return (
        <Figure kind={t('Video')} caption={media.caption}>
          <LessonVideo src={media.src} title={media.title} captions={media.captions} poster={media.poster} />
        </Figure>
      )
  }
}
