import { useState } from 'react'

import { componentImage } from '@/engine/component-images'
import { deviceImage, hasDevicePhoto } from '@/engine/device-images'
import { profileById } from '@/engine/profiles'
import type { ComponentType } from '@/engine/types'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const src = (file: string) => import.meta.env.BASE_URL + file

/** Photo the user uploaded for one of their own devices (a data URL kept with the profile). */
const userPhoto = (profileId: string | undefined) => profileById(profileId)?.photo

/** Small product thumbnail for a library row; renders nothing when the device has no photo. */
export function DeviceThumb({ profileId, className }: { profileId: string; className?: string }) {
  const img = deviceImage(profileId)
  const own = userPhoto(profileId)
  const [failed, setFailed] = useState(false)
  if ((!img && !own) || failed) return null
  return <img src={own ?? src(img!.file)} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className={cn('flex-none bg-white object-contain', className)} />
}

/** Product photo with its source, shown in the inspector. */
export function DevicePhoto({ profileId, name }: { profileId: string | undefined; name: string }) {
  const img = deviceImage(profileId)
  const own = userPhoto(profileId)
  const [failed, setFailed] = useState(false)
  if (own && !failed)
    return (
      <figure className="m-0 edge-b px-3 py-2">
        <img src={own} alt={name} onError={() => setFailed(true)} className="block h-36 w-full bg-white object-contain" />
        <figcaption className="mt-1 text-[10px] text-muted-foreground">{t('Photo: added by you')}</figcaption>
      </figure>
    )
  if (!img || failed) return null
  const host = new URL(img.sourcePage).hostname.replace(/^www\./, '')
  return (
    <figure className="m-0 edge-b px-3 py-2">
      <img src={src(img.file)} alt={name} loading="lazy" onError={() => setFailed(true)} className="block h-36 w-full bg-white object-contain" />
      <figcaption className="mt-1 text-[10px] text-pretty text-muted-foreground">
        {t(img.official ? 'Photo: manufacturer website' : 'Photo: reseller website')}
        {img.match === 'series' && ` · ${t('shows the product series')}`} ·{' '}
        <a href={img.sourcePage} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-2">
          {host}
        </a>
      </figcaption>
    </figure>
  )
}

/** Small photo for a generic catalog component; renders nothing when it has none. */
export function ComponentThumb({ type, className }: { type: ComponentType; className?: string }) {
  const img = componentImage(type)
  const [failed, setFailed] = useState(false)
  if (!img || failed) return null
  return <img src={src(img.file)} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className={cn('flex-none bg-white object-contain', className)} />
}

/** Author, licence and source for a generic component photo (required by CC BY / CC BY-SA). */
export function ComponentCredit({ type }: { type: ComponentType }) {
  const img = componentImage(type)
  if (!img) return null
  return (
    <span>
      {t('Photo')}: {img.author} ·{' '}
      {img.licenseUrl ? (
        <a href={img.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {img.license}
        </a>
      ) : (
        img.license
      )}{' '}
      ·{' '}
      <a href={img.filePage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {img.source ?? 'Wikimedia Commons'}
      </a>
      {img.modified && ` · ${t('cropped')}`}
    </span>
  )
}

/** Inspector photo: the device's product photo, otherwise the generic component photo. */
export function NodePhoto({ type, profileId, name }: { type: ComponentType; profileId: string | undefined; name: string }) {
  const [failed, setFailed] = useState(false)
  if (hasDevicePhoto(profileId)) return <DevicePhoto profileId={profileId} name={name} />
  const img = componentImage(type)
  if (!img || failed) return null
  return (
    <figure className="m-0 edge-b px-3 py-2">
      <img src={src(img.file)} alt={name} loading="lazy" onError={() => setFailed(true)} className="block h-36 w-full bg-white object-contain" />
      <figcaption className="mt-1 text-[10px] text-pretty text-muted-foreground">
        <ComponentCredit type={type} />
      </figcaption>
    </figure>
  )
}
