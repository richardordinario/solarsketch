/**
 * External search links for the library's right-click menu. They only build URLs that open in a
 * new tab on the user's click; the app itself still makes no third-party requests.
 */
import { CATALOG } from '@/engine/catalog'
import type { EquipmentProfile } from '@/engine/profiles'
import type { ComponentType } from '@/engine/types'

export type WebLink = 'price' | 'howto' | 'datasheet' | 'diagram' | 'safety'

/** What to search for: the device's brand and model, or the generic name plus its main rating. */
export function searchTerm(type: ComponentType, profile?: EquipmentProfile, sub?: string): string {
  if (profile) return `${profile.brand} ${profile.model}`
  const rating = sub?.split(' · ')[0]
  return rating ? `${CATALOG[type].name} ${rating}` : CATALOG[type].name
}

const google = (q: string, extra = '') => `https://www.google.com/search?q=${encodeURIComponent(q)}${extra}`
const youtube = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`

export function webLink(kind: WebLink, type: ComponentType, term: string): string {
  const name = CATALOG[type].name
  const isLoad = CATALOG[type].cat === 'Electrical Loads'
  switch (kind) {
    case 'price':
      return google(`${term} price Philippines`)
    case 'howto':
      return youtube(isLoad ? `${name} on solar power how many watts` : `how to install ${name} solar tutorial`)
    case 'datasheet':
      return google(`${term} datasheet pdf`)
    case 'diagram':
      return google(`${name} solar wiring diagram`, '&udm=2')
    case 'safety':
      return google(`${name} solar installation safety tips`)
  }
}

export const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
